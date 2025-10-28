import axios from "axios";
import { withRateLimit } from "./rateLimiter";

function mapChain(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes("eth")) return "ethereum";
  if (c.includes("polygon")) return "polygon";
  if (c.includes("base")) return "base";
  if (c.includes("arb")) return "arbitrum";
  return "ethereum";
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e; const delay = baseDelayMs * 2 ** i + Math.random() * 100; await new Promise(r => setTimeout(r, delay));
    }
  }
  if (lastErr instanceof Error) throw lastErr; throw new Error(String(lastErr));
}

export type DexPair = {
  chainId?: string;
  dexId?: string;
  priceUsd?: string | number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
};

export const dexscreenerService = {
  async getPairs(contractAddress: string) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
    const { data } = await withRateLimit("dexscreener", () => retry(() => axios.get(url, { timeout: 10000 })));
    const pairs: DexPair[] = Array.isArray(data?.pairs) ? data.pairs : [];
    return pairs;
  },

  async getBestPair(contractAddress: string, chain: string) {
    const wantChain = mapChain(chain);
    const pairs = await this.getPairs(contractAddress);
    const filtered = pairs.filter(p => (p.chainId?.toLowerCase() ?? "") === wantChain);
    const list = filtered.length > 0 ? filtered : pairs;
    if (list.length === 0) return null;
    const best = list.reduce((a, b) => {
      const la = Number(a?.liquidity?.usd ?? 0); const lb = Number(b?.liquidity?.usd ?? 0);
      return lb > la ? b : a;
    }, list[0]);
    return best;
  },

  async getTokenMetadata(contractAddress: string, chain: string): Promise<{ name: string; symbol: string; logoUrl?: string }> {
    const best = await this.getBestPair(contractAddress, chain);
    const name = best?.baseToken?.name ?? "Token";
    const symbol = best?.baseToken?.symbol ?? "TKN";
    // Dexscreener images are predictable
    const logoUrl = `https://dd.dexscreener.com/ds-data/tokens/${mapChain(chain)}/${contractAddress.toLowerCase()}.png`;
    return { name, symbol, logoUrl };
  },
};
