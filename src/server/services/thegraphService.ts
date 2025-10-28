import axios from "axios";
import { metrics } from "./observability";
import mapping from "./chainToSubgraph.json";

type VolumePoint = { date: string; volume: number };

function getChainSubgraphs(chain: string): string[] {
  const c = (chain || "").toLowerCase();
  const m = (mapping as Record<string, Record<string, string>>)[c];
  if (!m) return [];
  return Object.values(m);
}

function daysForRange(range: string): number {
  switch (range) {
    case "24h":
      return 2;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 60;
  }
}

export const thegraphService = {
  // Aggregate daily swap volume for a token across Uniswap V2 & V3
  async tokenDailyVolumeUSD(contract: string, chain: string, range: string): Promise<{ series: VolumePoint[]; source: string }> {
    const days = daysForRange(range);
    const subgraphs = getChainSubgraphs(chain);
    if (subgraphs.length === 0) {
      return { series: [], source: "mock" };
    }

    const q = `
      query ($addr: String!, $days: Int!) {
        tokenDayDatas(first: $days, orderBy: date, orderDirection: desc, where: { token: $addr }) {
          date
          volumeUSD
          dailyVolumeToken
          priceUSD
        }
      }
    `;

    const addr = contract.toLowerCase();
    const aggregated = new Map<string, number>();

    for (const url of subgraphs) {
      try {
        const r = await axios.post(url, { query: q, variables: { addr, days } }, { timeout: 15000 });
        const rows: Array<{ date?: number; volumeUSD?: string | number; dailyVolumeToken?: string | number; priceUSD?: string | number }> = r?.data?.data?.tokenDayDatas ?? [];
        for (const row of rows) {
          const day = new Date((Number(row?.date ?? 0)) * 1000).toISOString().slice(0, 10);
          const vol = row?.volumeUSD != null ? Number(row.volumeUSD) : Number(row?.dailyVolumeToken ?? 0) * Number(row?.priceUSD ?? 0);
          if (!day || !isFinite(vol)) continue;
          aggregated.set(day, (aggregated.get(day) ?? 0) + vol);
        }
        metrics.inc("providers.thegraph.calls");
      } catch {
        metrics.inc("providers.thegraph.errors");
      }
    }

    const series = Array.from(aggregated.entries())
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { series, source: series.length > 0 ? "thegraph" : "mock" };
  },
};

export default thegraphService;
