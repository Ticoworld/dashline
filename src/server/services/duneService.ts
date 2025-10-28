// import axios from "axios"; // Reserved for real Dune API calls

export type HolderPoint = { date: string; holders: number };
export type VolumePoint = { date: string; volume: number };

const DUNE_API_KEY = process.env.DUNE_API_KEY;

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const delay = baseDelayMs * 2 ** i + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Normalize thrown value to Error
  if (lastErr instanceof Error) throw lastErr;
  throw new Error(String(lastErr));
}

function mockTimeSeries(mapper: (i: number) => number, days: number): Array<{ date: string; value: number }> {
  const arr: Array<{ date: string; value: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    arr.push({ date: d.toISOString().slice(0, 10), value: mapper(days - i) });
  }
  return arr;
}

function resolveDays(timeRange: string): number {
  switch (timeRange) {
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

export const duneService = {
  async fetchHolderData(contractAddress: string, timeRange: string): Promise<HolderPoint[]> {
    console.log("[dune] fetchHolderData", { contractAddress, timeRange });
    const days = resolveDays(timeRange);
    if (!DUNE_API_KEY) {
      return mockTimeSeries((i) => 1000 + Math.round(i * 10 + Math.sin(i / 2) * 20), days).map((p) => ({ date: p.date, holders: p.value }));
    }
    // TODO: Replace with actual Dune query execution and polling
    return retry(async () => {
      // Placeholder: simulate API
      const days = resolveDays(timeRange);
      return mockTimeSeries((i) => 1200 + Math.round(i * 8 + Math.cos(i / 3) * 15), days).map((p) => ({ date: p.date, holders: p.value }));
    });
  },

  async fetchVolumeData(contractAddress: string, timeRange: string): Promise<VolumePoint[]> {
    console.log("[dune] fetchVolumeData", { contractAddress, timeRange });
    const days = resolveDays(timeRange);
    if (!DUNE_API_KEY) {
      return mockTimeSeries((i) => Math.max(0, 10000 + Math.round(5000 * Math.sin(i / 5) + i * 100)), days).map((p) => ({ date: p.date, volume: p.value }));
    }
    return retry(async () => {
      const days = resolveDays(timeRange);
      return mockTimeSeries((i) => Math.max(0, 15000 + Math.round(4000 * Math.cos(i / 4) + i * 120)), days).map((p) => ({ date: p.date, volume: p.value }));
    });
  },

  async fetchTopHolders(contractAddress: string, limit: number): Promise<Array<{ address: string; balance: number; percentage: number; rank: number }>> {
    console.log("[dune] fetchTopHolders", { contractAddress, limit });
    if (!DUNE_API_KEY) {
      const total = 1_000_000;
      return Array.from({ length: limit }).map((_, i) => {
        const balance = Math.round((total / (i + 2)) * 0.05);
        return { address: `0x${(i + 1).toString().padStart(40, "0")}`, balance, percentage: (balance / total) * 100, rank: i + 1 };
      });
    }
    return retry(async () => {
      const total = 1_000_000;
      return Array.from({ length: limit }).map((_, i) => {
        const balance = Math.round((total / (i + 2)) * 0.06);
        return { address: `0x${(i + 1).toString().padStart(40, "0")}`, balance, percentage: (balance / total) * 100, rank: i + 1 };
      });
    });
  },

  async validateContract(contractAddress: string, chain: string): Promise<{ name: string; symbol: string; tokenStandard: string; logoUrl?: string; description?: string }> {
    console.log("[dune] validateContract", { contractAddress, chain });
    if (!DUNE_API_KEY) {
      return { name: "Mock Token", symbol: "MOCK", tokenStandard: "ERC20", logoUrl: undefined };
    }
    return retry(async () => {
      // In a real implementation, call indexer or Dune query to validate
      return { name: "Validated Token", symbol: "VAL", tokenStandard: "ERC20" };
    });
  },
};
