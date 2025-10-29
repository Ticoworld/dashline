import axios from "axios";
import { withRateLimit } from "./rateLimiter";
import { metrics } from "./observability";
import { dexscreenerService } from "./dexscreenerService";
import { bitqueryService, BitqueryTopHolder } from "./bitqueryService";

// Lightweight ethers v6 import (optional at runtime)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EthersLike = any;
let ethersMod: EthersLike | null = null;
async function getEthers() {
  if (ethersMod) return ethersMod;
  try {
    const mod = await import("ethers");
    ethersMod = (mod as unknown as EthersLike) ?? null;
  } catch {
    ethersMod = null;
  }
  return ethersMod;
}

// Types
export type HolderTag = "burn" | "lp" | "exchange" | "treasury" | "timelock";
export type TopHolder = {
  address: string;
  balance: number; // normalized to decimals
  totalSupplyShare: number; // 0..1
  circulatingShare: number; // 0..1
  tags: HolderTag[];
};

export type HoldersSummary = {
  topHolders: TopHolder[];
  totalHolders: number;
  source: "bitquery" | "moralis" | "mock" | "etherscan";
  lastUpdatedAt: string; // ISO
  partial?: boolean; // true if provider limited
};

export type HolderSeriesPoint = { date: string; value: number };

function normalizeChain(chain: string): { evmChain: string; moralis: string } {
  const c = chain.toLowerCase();
  switch (c) {
    case "polygon":
      return { evmChain: "polygon", moralis: "polygon" };
    case "base":
      return { evmChain: "base", moralis: "base" };
    case "ethereum":
    default:
      return { evmChain: "ethereum", moralis: "eth" };
  }
}

// On-chain helpers
async function fetchOnchainMeta(contract: string, _chain: string): Promise<{ decimals: number; totalSupply: bigint }> {
  void _chain;
  const ethers = await getEthers();
  if (!ethers) return { decimals: 18, totalSupply: BigInt(0) };

  const rpcUrl =
    process.env.QUICKNODE_RPC ||
    (process.env.ALCHEMY_KEY && `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`) ||
    (process.env.INFURA_KEY && `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`) ||
    process.env.PUBLIC_RPC_URL ||
    "https://rpc.ankr.com/eth";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = [
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ];
  const contractRead = new ethers.Contract(contract, abi, provider);
  try {
    const [dec, supply] = await Promise.all([contractRead.decimals(), contractRead.totalSupply()]);
    return { decimals: Number(dec ?? 18), totalSupply: BigInt(supply ?? 0) };
  } catch {
    return { decimals: 18, totalSupply: BigInt(0) };
  }
}

function isBurnAddress(addr: string): boolean {
  const a = addr.toLowerCase();
  return a === "0x0000000000000000000000000000000000000000" || a === "0x000000000000000000000000000000000000dead";
}

// Provider calls

// Moralis returns RAW (smallest unit) balances; keep as BigInt here and normalize later with decimals.
async function moralisTopHolders(
  contract: string,
  chain: string,
  pageSize = 500
): Promise<{ holders: Array<{ address: string; balance: bigint }>; totalHolders: number } | null> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) return null;
  const { moralis } = normalizeChain(chain);
  const base = `https://deep-index.moralis.io/api/v2.2/erc20/${contract}/holders`;
  let cursor: string | null = null;
  const holders = new Map<string, bigint>();
  let pages = 0;
  while (true) {
    const url = new URL(base);
    url.searchParams.set("chain", moralis);
    url.searchParams.set("limit", String(pageSize));
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await withRateLimit("moralis", async () => {
      const t0 = Date.now();
      try {
        const r = await axios.get(url.toString(), { headers: { "X-API-Key": key }, timeout: 15000 });
        metrics.inc("providers.moralis.calls");
        const latency = Date.now() - t0;
        metrics.inc(`providers.moralis.latency_ms.${Math.min(1000, Math.ceil(latency / 100) * 100)}`);
        return r.data;
      } catch (e) {
        metrics.inc("providers.moralis.errors");
        throw e;
      }
    });
    const items: Array<{ address?: string; balance?: string | number }> = data?.result ?? data?.items ?? [];
    for (const it of items) {
      const addr = String(it?.address ?? "").toLowerCase();
      if (!addr) continue;
      const v = BigInt(it?.balance ?? 0);
      holders.set(addr, (holders.get(addr) ?? BigInt(0)) + v);
    }
    cursor = data?.cursor ?? data?.next ?? null;
    pages++;
    if (!cursor || pages > 200) break; // safety cap
  }
  const out = Array.from(holders.entries())
    .map(([address, balance]) => ({ address, balance }))
    .sort((a, b) => (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1));
  return { holders: out, totalHolders: holders.size };
}

// Compute shares from normalized balances (numbers) and normalized supply (number).
function calcShares(
  holdersNorm: Array<{ address: string; balance: number }>,
  totalSupplyRaw: bigint,
  decimals: number,
  lpAddresses: Set<string>
): { top: TopHolder[]; sumBurn: number; sumLP: number } {
  const denom = Number(BigInt(10) ** BigInt(Math.max(0, decimals)));
  const totalSupplyNorm = denom > 0 ? Number(totalSupplyRaw) / denom : 0;

  let sumBurn = 0;
  let sumLP = 0;
  for (const h of holdersNorm) {
    const lower = h.address.toLowerCase();
    if (isBurnAddress(lower)) sumBurn += h.balance;
    if (lpAddresses.has(lower)) sumLP += h.balance;
  }

  const circSupplyNorm = Math.max(0, totalSupplyNorm - sumBurn - sumLP);

  const top: TopHolder[] = holdersNorm.map((h) => {
    const tags: HolderTag[] = [];
    const lower = h.address.toLowerCase();
    if (isBurnAddress(lower)) tags.push("burn");
    if (lpAddresses.has(lower)) tags.push("lp");
    const totalShare = totalSupplyNorm > 0 ? h.balance / totalSupplyNorm : 0;
    const circShare = circSupplyNorm > 0 ? h.balance / circSupplyNorm : 0;
    return {
      address: h.address,
      balance: h.balance,
      totalSupplyShare: totalShare,
      circulatingShare: Math.max(0, circShare),
      tags,
    };
  });

  return { top, sumBurn, sumLP };
}

async function lpAddressesFromDexscreener(): Promise<Set<string>> {
  try {
    await dexscreenerService.getPairs("0x0");
    return new Set();
  } catch {
    return new Set();
  }
}

export const holdersService = {
  // Returns holders summary with provider priority (override via env PROVIDERS_PRIORITY_HOLDERS)
  async summary(contract: string, chain: string, opts: { limitTop?: number } = {}): Promise<HoldersSummary> {
    console.log(`[holdersService] summary called for ${contract} on ${chain}`);
    const limitTop = Math.max(10, Math.min(1000, opts.limitTop ?? 200));
    let source: HoldersSummary["source"] = "mock";
    const partial = false;

    // Determine provider priority order
    const priority = (process.env.PROVIDERS_PRIORITY_HOLDERS ?? "bitquery,moralis")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => !!s);
    
    console.log(`[holdersService] Provider priority:`, priority);

    // Intermediate storage
    let bitqueryHolders: BitqueryTopHolder[] | null = null;
    let moralisRaw: Array<{ address: string; balance: bigint }> | null = null;
    let totalHoldersGuess = 0;

    for (const p of priority) {
      if (bitqueryHolders || moralisRaw) break;
      console.log(`[holdersService] Trying provider: ${p}`);
      switch (p) {
        case "bitquery": {
          try {
            const [totalRes, topRes] = await Promise.all([
              bitqueryService.getTokenHolderCount(contract, chain),
              bitqueryService.getTopHolders(contract, chain, 5000),
            ]);
            const holders = topRes?.topHolders ?? [];
            console.log(`[holdersService] Bitquery returned ${holders.length} holders`);
            if (holders.length > 0 && topRes.source === "bitquery") {
              bitqueryHolders = holders;
              totalHoldersGuess = totalRes?.total && totalRes.total > 0 ? totalRes.total : holders.length;
              source = "bitquery";
              console.log(`[holdersService] Using Bitquery data: ${totalHoldersGuess} total holders`);
            }
          } catch (e) {
            console.error("[holdersService] Bitquery fetch failed", e);
            metrics.inc("providers.bitquery.errors");
          }
          break;
        }
        case "moralis": {
          try {
            const res = await moralisTopHolders(contract, chain, 1000);
            if (res && res.holders.length > 0) {
              moralisRaw = res.holders;
              totalHoldersGuess = res.totalHolders;
              source = "moralis";
              console.log(`[holdersService] Using Moralis data: ${totalHoldersGuess} total holders`);
            }
          } catch (e) {
            console.error("[holdersService] Moralis fetch failed", e);
          }
          break;
        }
        default:
          break;
      }
    }

    if (!bitqueryHolders && !moralisRaw) {
      console.warn("[holdersService] No holder data available from any provider");
      return {
        topHolders: [],
        totalHolders: 0,
        source: source ?? "mock",
        lastUpdatedAt: new Date().toISOString(),
        partial: true,
      };
    }

    console.log(`[holdersService] Fetching on-chain metadata for ${contract}`);
    const meta = await fetchOnchainMeta(contract, chain);
    console.log(`[holdersService] On-chain meta:`, { decimals: meta.decimals, totalSupply: meta.totalSupply.toString() });
    const lps = await lpAddressesFromDexscreener();

    // Normalize holders to numbers (token units) for share calculations
    let holdersNorm: Array<{ address: string; balance: number }> = [];
    if (bitqueryHolders) {
      holdersNorm = bitqueryHolders
        .map((h) => ({ address: h.address, balance: Number(h.balance) }))
        .filter((h) => Number.isFinite(h.balance));
      console.log(`[holdersService] Normalized ${holdersNorm.length} Bitquery holders`);
    } else if (moralisRaw) {
      const denom = Number(BigInt(10) ** BigInt(Math.max(0, meta.decimals)));
      holdersNorm = moralisRaw.map((h) => ({
        address: h.address,
        balance: denom > 0 ? Number(h.balance) / denom : 0,
      }));
      console.log(`[holdersService] Normalized ${holdersNorm.length} Moralis holders`);
    }

    // Limit top then compute shares
    const { top } = calcShares(holdersNorm.slice(0, limitTop), meta.totalSupply, meta.decimals, lps);
    console.log(`[holdersService] Returning ${top.length} top holders`);

    return {
      topHolders: top,
      totalHolders: totalHoldersGuess,
      source,
      lastUpdatedAt: new Date().toISOString(),
      partial,
    };
  },

  // Holder growth time series: use explicit date range; prefer Bitquery, fallback to synthetic
  async holderSeries(contract: string, chain: string, days: number): Promise<{ chartData: HolderSeriesPoint[]; source: string; synthetic: boolean }> {
    const key = process.env.BITQUERY_API_KEY;
    if (key) {
      try {
        const { evmChain } = normalizeChain(chain);
        const endpoint = "https://graphql.bitquery.io";

        const till = new Date();
        const since = new Date(Date.UTC(till.getUTCFullYear(), till.getUTCMonth(), till.getUTCDate()));
        since.setUTCDate(since.getUTCDate() - (days - 1));

        const query = `
          query HolderDaily($network: EthereumNetwork!, $address: String!, $since: ISO8601DateTime, $till: ISO8601DateTime) {
            ethereum(network: $network) {
              transfers(
                date: {since: $since, till: $till}
                currency: {is: $address}
              ) {
                date: date { date }
                distinctReceivers: count(uniq: receiver)
              }
            }
          }
        `;
        const resp = await withRateLimit("bitquery", async () => {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (key.startsWith("ory_") || key.startsWith("ory.at") || key.startsWith("ory_at_")) {
            headers["Authorization"] = `Bearer ${key}`;
          } else {
            headers["X-API-KEY"] = key;
          }
          const r = await axios.post(
            endpoint,
            {
              query,
              variables: {
                network: evmChain === "ethereum" ? "ethereum" : evmChain,
                address: contract,
                since: since.toISOString(),
                till: till.toISOString(),
              },
            },
            { headers, timeout: 15000 }
          );
          metrics.inc("providers.bitquery.calls");
          return r.data;
        });
        const rows: Array<{ date?: { date?: string }; distinctReceivers?: number }> = resp?.data?.ethereum?.transfers ?? [];
        const series = rows
          .map((r) => ({ date: String(r?.date?.date ?? "").slice(0, 10), value: Number(r?.distinctReceivers ?? 0) }))
          .filter((p) => p.date)
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        if (series.length > 0) return { chartData: series, source: "bitquery", synthetic: false };
      } catch {
        // ignore
      }
    }

    // Synthetic fallback
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const base = 50;
    const out: HolderSeriesPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      out.push({ date: d.toISOString().slice(0, 10), value: Math.max(0, base + i * 5 + Math.round(Math.sin(i / 3) * 10)) });
    }
    return { chartData: out, source: "synthetic", synthetic: true };
  },
};

export const __internal = { calcShares };