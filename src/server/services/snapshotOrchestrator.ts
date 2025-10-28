import type { Prisma } from "@/generated/prisma";
import { metrics } from "@/server/services/observability";
import {
  assembleHoldersMetric,
  assemblePriceMetric,
  assembleTopHoldersMetric,
  assembleTransactionsMetric,
  assembleVolumeMetric,
  ProjectContext,
  TimeRangeOption,
} from "@/server/services/metricAssembler";
import {
  getLatestSnapshot,
  getFreshSnapshot,
  isSnapshotExpired,
  upsertSnapshot,
} from "@/server/services/snapshotService";

const DEFAULT_RANGES: TimeRangeOption[] = ["24h", "7d", "30d", "90d"];

export type SnapshotMetricConfig = {
  key: string;
  ttlMinutes: number;
  ranges?: TimeRangeOption[];
  collect: (project: ProjectContext, range?: TimeRangeOption) => Promise<{ source: string; value: Prisma.JsonValue }>;
};

function makeMetricKey(base: string, range?: TimeRangeOption) {
  return range ? `${base}:${range}` : base;
}

const METRIC_CONFIGS: SnapshotMetricConfig[] = [
  {
    key: "holdersV2",
    ttlMinutes: 10,
    ranges: DEFAULT_RANGES,
    collect: async (project, range = "7d") => {
      const data = await assembleHoldersMetric(project, range);
      const { source, ...rest } = data;
      const chart = (rest as { chartData?: unknown }).chartData as unknown;
      const arr = Array.isArray(chart) ? (chart as unknown[]) : [];
      const dataEmpty = arr.length === 0;
      const value = { ...(rest as Record<string, unknown>), dataEmpty } as unknown as Prisma.JsonValue;
      return { source, value };
    },
  },
  {
    key: "volumeV2",
    ttlMinutes: 5,
    ranges: DEFAULT_RANGES,
    collect: async (project, range = "7d") => {
      const data = await assembleVolumeMetric(project, range);
      const { source, ...rest } = data;
      const chart = (rest as { chartData?: unknown }).chartData as unknown;
      const arr = Array.isArray(chart) ? (chart as unknown[]) : [];
      const dataEmpty = arr.length === 0;
      const value = { ...(rest as Record<string, unknown>), dataEmpty } as unknown as Prisma.JsonValue;
      return { source, value };
    },
  },
  {
    key: "transactionsV2",
    ttlMinutes: 5,
    ranges: DEFAULT_RANGES,
    collect: async (project, range = "7d") => {
      const data = await assembleTransactionsMetric(project, range);
      const { source, ...rest } = data;
      const chart = (rest as { chartData?: unknown }).chartData as unknown;
      const arr = Array.isArray(chart) ? (chart as unknown[]) : [];
      const dataEmpty = arr.length === 0;
      const value = { ...(rest as Record<string, unknown>), dataEmpty } as unknown as Prisma.JsonValue;
      return { source, value };
    },
  },
  {
    key: "priceV2",
    ttlMinutes: 1,
    collect: async (project) => {
      const data = await assemblePriceMetric(project);
      const { source, ...value } = data;
  return { source, value: value as unknown as Prisma.JsonValue };
    },
  },
  {
    key: "topHoldersV2",
    ttlMinutes: 30,
    collect: async (project) => {
      const data = await assembleTopHoldersMetric(project, 10);
      const { source, ...rest } = data;
      const holders = (rest as { holders?: unknown }).holders as unknown;
      const arr = Array.isArray(holders) ? (holders as unknown[]) : [];
      const dataEmpty = arr.length === 0;
      const value = { ...(rest as Record<string, unknown>), dataEmpty } as unknown as Prisma.JsonValue;
      return { source, value };
    },
  },
  {
    key: "liquidityMixV2",
    ttlMinutes: 10,
    collect: async (project) => {
      // To keep deps local, compute here via providerService through metric assembler-like path
      // We avoid a dedicated assembler for now since it's a simple aggregate
      const { dexscreenerService } = await import("@/server/services/dexscreenerService");
      const pairs = await dexscreenerService.getPairs(project.contractAddress);
      const byDex = new Map<string, number>();
      for (const p of pairs) {
        const dex = (p.dexId ?? "Unknown").toString();
        const liq = Number(p?.liquidity?.usd ?? 0);
        byDex.set(dex, (byDex.get(dex) ?? 0) + (isFinite(liq) ? liq : 0));
      }
      const total = Array.from(byDex.values()).reduce((a, b) => a + b, 0);
      const items = Array.from(byDex.entries())
        .map(([name, usd]) => ({ name, value: total > 0 ? Math.round((usd / total) * 100) : 0 }))
        .sort((a, b) => b.value - a.value);
      return { source: "dexscreener", value: { items } as unknown as Prisma.JsonValue };
    },
  },
];

export type SnapshotRefreshOutcome = {
  metric: string;
  refreshed: boolean;
  reason?: string;
  error?: string;
  source?: string;
};

export type ProjectSnapshotRefreshResult = {
  projectId: string;
  outcomes: SnapshotRefreshOutcome[];
};

export async function refreshSnapshotsForProject(
  project: ProjectContext,
  options: { now?: number; force?: boolean; ranges?: TimeRangeOption[] } = {}
): Promise<ProjectSnapshotRefreshResult> {
  const now = options.now ?? Date.now();
  const ranges = options.ranges ?? DEFAULT_RANGES;
  const outcomes: SnapshotRefreshOutcome[] = [];

  for (const config of METRIC_CONFIGS) {
    const activeRanges = config.ranges ? config.ranges.filter((r) => ranges.includes(r)) : [undefined];
    for (const range of activeRanges) {
      const metricKey = makeMetricKey(config.key, range);
      try {
        const snapshot = await getLatestSnapshot(project.id, metricKey);
        const shouldRefresh =
          options.force ||
          !snapshot ||
          isSnapshotExpired(snapshot, now);

        if (!shouldRefresh) {
          outcomes.push({ metric: metricKey, refreshed: false, reason: "fresh" });
          continue;
        }

        const { source, value } = await config.collect(project, range);
        // Telemetry: track synthetic/empty data
        try {
          // If the assembler marked data as empty or the source is synthetic, increment a metric
          const empty = typeof value === "object" && value !== null && (value as Record<string, unknown>)["dataEmpty"] === true;
          if (source === "synthetic" || empty) {
            metrics.inc(`snapshots.synthetic.${config.key}`);
          }
        } catch {}
        await upsertSnapshot({
          projectId: project.id,
          metric: metricKey,
          value,
          source,
          ttlMinutes: config.ttlMinutes,
          collectedAt: new Date(now),
        });
        metrics.inc(`snapshots.refresh.success.${config.key}`);
        outcomes.push({ metric: metricKey, refreshed: true, source });
      } catch (error) {
        metrics.inc(`snapshots.refresh.error.${config.key}`);
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ metric: metricKey, refreshed: false, error: message });
      }
    }
  }

  return { projectId: project.id, outcomes };
}

export async function ensureFreshSnapshot(
  project: ProjectContext,
  metricKey: string,
  options: {
    now?: number;
    ttlMinutes?: number;
    fallbackCollect?: () => Promise<{ source: string; value: Prisma.JsonValue }>;
  }
) {
  const now = options.now ?? Date.now();
  const snapshot = await getFreshSnapshot(project.id, metricKey, now);
  if (snapshot) return snapshot;

  if (!options.fallbackCollect) return null;

  const { source, value } = await options.fallbackCollect();
  await upsertSnapshot({
    projectId: project.id,
    metric: metricKey,
    value,
    source,
    ttlMinutes: options.ttlMinutes ?? 5,
    collectedAt: new Date(now),
  });
  return getFreshSnapshot(project.id, metricKey, now);
}

export function getMetricConfigs() {
  return METRIC_CONFIGS;
}
