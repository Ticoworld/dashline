import axios from "axios";
import { withRateLimit } from "./rateLimiter";
import { metrics } from "./observability";

function normalizeMoralisChain(chain: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("eth")) return "eth";
  if (c.includes("polygon") || c.includes("matic")) return "polygon";
  if (c.includes("base")) return "base";
  if (c.includes("arb") || c.includes("arbitrum")) return "arbitrum";
  return "eth";
}

function startOfUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const moralisService = {
  // Get token holder statistics (total holders) using Moralis stats endpoint
  async getTokenHolderStats(
    contractAddress: string,
    chain: string = "ethereum"
  ): Promise<{ total: number; source: "moralis" } | null> {
    const key = process.env.MORALIS_API_KEY;
    if (!key) return null;

    const moralisChain = normalizeMoralisChain(chain);
    const url = new URL(`https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/holders`);
    url.searchParams.set("chain", moralisChain);

    try {
      console.log(`[moralisService] Fetching holder stats from ${url.toString()}`);
      const data = await withRateLimit("moralis", async () => {
        const t0 = Date.now();
        try {
          const r = await axios.get(url.toString(), { headers: { "X-API-Key": key }, timeout: 15000 });
          metrics.inc("providers.moralis.calls");
          const latency = Date.now() - t0;
          metrics.inc(`providers.moralis.latency_ms.${Math.min(1000, Math.ceil(latency / 100) * 100)}`);
          return r.data as Record<string, unknown>;
        } catch (e) {
          console.error("[moralisService] Holder stats API error:", e);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ax: any = e;
          if (ax?.response) {
            console.error("[moralisService] Status:", ax.response.status);
            console.error("[moralisService] Data:", ax.response.data);
          }
          metrics.inc("providers.moralis.errors");
          throw e;
        }
      });

      // Moralis v2.2 returns totalHolders (camelCase)
      const possible = [
        (data as { totalHolders?: number })?.totalHolders,
        (data as { total?: number })?.total,
        (data as { holders?: number })?.holders,
        (data as { address_count?: number })?.address_count,
        Number((data as { count?: string | number })?.count ?? NaN),
      ].filter((v) => Number.isFinite(Number(v)) && Number(v) > 0) as number[];

      const total = possible.length > 0 ? Number(possible[0]) : 0;
      console.log(`[moralisService] Holder stats total parsed: ${total}`);
      if (total > 0) return { total, source: "moralis" };
      return null;
    } catch (err) {
      console.error("[moralisService] getTokenHolderStats failed:", err);
      return null;
    }
  },

  // Fetch token holders list and total from Moralis API (using /owners endpoint)
  async getTokenHolders(
    contractAddress: string,
    chain: string = "ethereum",
    limit: number = 100
  ): Promise<{
    holders: Array<Record<string, unknown>>;
    total: number;
    source: "moralis";
  } | null> {
    const key = process.env.MORALIS_API_KEY;
    if (!key) return null;

    const moralisChain = normalizeMoralisChain(chain);
    // Use /owners endpoint (correct Moralis v2.2 endpoint)
    const base = `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/owners`;

    try {
      const url = new URL(base);
      url.searchParams.set("chain", moralisChain);
      url.searchParams.set("limit", String(Math.max(1, Math.min(100, limit)))); // Moralis max is 100

      console.log(`[moralisService] Fetching holders from ${url.toString()}`);

      const data = await withRateLimit("moralis", async () => {
        const t0 = Date.now();
        try {
          const r = await axios.get(url.toString(), { headers: { "X-API-Key": key }, timeout: 15000 });
          metrics.inc("providers.moralis.calls");
          const latency = Date.now() - t0;
          metrics.inc(`providers.moralis.latency_ms.${Math.min(1000, Math.ceil(latency / 100) * 100)}`);
          console.log(`[moralisService] API Response status: ${r.status}, data length: ${JSON.stringify(r.data).length}`);
          return r.data;
        } catch (e) {
          console.error("[moralisService] API Error:", e);
          if (axios.isAxiosError(e)) {
            console.error("[moralisService] Response status:", e.response?.status);
            console.error("[moralisService] Response data:", e.response?.data);
          }
          metrics.inc("providers.moralis.errors");
          throw e;
        }
      });

      // Moralis API v2.2 returns 'result' array
      const items: Array<Record<string, unknown>> = data?.result ?? data?.items ?? [];
      const total: number = Number(data?.total ?? items.length ?? 0);
      
      console.log(`[moralisService] Got ${items.length} holders, total: ${total}`);
      if (items.length > 0) {
        console.log(`[moralisService] Sample holder:`, items[0]);
      }
      
      return { holders: items, total, source: "moralis" };
    } catch (err) {
      console.error("[moralisService] getTokenHolders failed:", err);
      return null;
    }
  },

  // Build a daily series of transfer counts for this ERC20 contract using Moralis.
  // Returns series sorted ASC by date: [{ date: 'YYYY-MM-DD', count: number }]
  async getContractTxSeries(contractAddress: string, chain: string, days: number): Promise<Array<{ date: string; count: number }>> {
    const key = process.env.MORALIS_API_KEY;
    if (!key) return [];

    const moralisChain = normalizeMoralisChain(chain);
    const base = `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/transfers`;

    // Compute window [since, till]
    const till = startOfUTC(new Date());
    const since = new Date(till);
    since.setUTCDate(till.getUTCDate() - (days - 1));

    const perDay = new Map<string, number>();
    let cursor: string | null = null;
    let pages = 0;

    while (true) {
      const url = new URL(base);
      url.searchParams.set("chain", moralisChain);
      url.searchParams.set("from_date", fmt(since));
      url.searchParams.set("to_date", fmt(till));
      url.searchParams.set("limit", "100");
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

      const items: Array<{ block_timestamp?: string }> = data?.result ?? data?.items ?? [];
      if (pages === 0) {
        console.log(`[moralisService] First page: got ${items.length} transfers`);
        if (items.length > 0) {
          console.log(`[moralisService] Sample transfer:`, items[0]);
        }
      }
      for (const it of items) {
        const ts = String(it?.block_timestamp ?? "");
        if (!ts) continue;
        const d = ts.slice(0, 10); // YYYY-MM-DD
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
      }

      cursor = data?.cursor ?? data?.next ?? null;
      pages++;
      // stop if no more pages or we fetched enough to cover the window safely
      if (!cursor || pages > 100) break;
    }

    // Build ASC series for each day in window
    console.log(`[moralisService] Processed ${pages} pages, found transfers on ${perDay.size} unique days`);
    if (perDay.size > 0) {
      const datesWithActivity = Array.from(perDay.entries())
        .filter(([, count]) => count > 0)
        .sort(([a], [b]) => a.localeCompare(b));
      console.log(`[moralisService] Date range with activity: ${datesWithActivity[0]?.[0]} to ${datesWithActivity[datesWithActivity.length - 1]?.[0]}`);
      console.log(`[moralisService] Sample activity: ${datesWithActivity.slice(0, 3).map(([d, c]) => `${d}:${c}`).join(', ')}`);
    }
    const out: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const keyDate = fmt(d);
      out.push({ date: keyDate, count: perDay.get(keyDate) ?? 0 });
    }

    console.log(`[moralisService] Returning ${out.length} days, non-zero days: ${out.filter(p => p.count > 0).length}`);
    console.log(`[moralisService] Requested range: ${fmt(since)} to ${fmt(till)}`);
    return out;
  },
};

export default moralisService;
