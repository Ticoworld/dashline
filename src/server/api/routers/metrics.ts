import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, rateLimited } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { providerService } from "@/server/services/providerService";
import {
  assembleHoldersMetric,
  assemblePriceMetric,
  assembleTransactionsMetric,
  assembleVolumeMetric,
  ProjectContext,
  HoldersMetric,
  VolumeMetric,
  PriceMetric,
  TransactionsMetric,
  TopHoldersMetric,
} from "@/server/services/metricAssembler";
import { ensureFreshSnapshot } from "@/server/services/snapshotOrchestrator";

const timeRangeEnum = z.enum(["24h", "7d", "30d", "90d", "all"]);

export const metricsRouter = router({
  getHolders: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string(), timeRange: timeRangeEnum }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

  const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
  const metricKey = `holdersV2:${project.id}:${input.timeRange}`;
      const snapshot = await ensureFreshSnapshot(ctxProject, metricKey, {
        ttlMinutes: 10,
        fallbackCollect: async () => {
          const data = await assembleHoldersMetric(ctxProject, input.timeRange);
          const { source, ...rest } = data;
          return { source, value: rest };
        },
      });
  const value = snapshot?.value as unknown as Omit<HoldersMetric, "source"> & { dataEmpty?: boolean };
  return {
        ...value,
        source: snapshot?.source ?? "unknown",
        lastUpdatedAt: snapshot?.collectedAt ?? null,
        meta: { source: snapshot?.source ?? "unknown", lastUpdatedAt: snapshot?.collectedAt ?? null, ttlMinutes: 10, dataEmpty: Boolean(value?.dataEmpty) },
      };
    }),

  getVolume: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string(), timeRange: timeRangeEnum }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
  const metricKey = `volumeV2:${project.id}:${input.timeRange}`;
      const snapshot = await ensureFreshSnapshot(ctxProject, metricKey, {
        ttlMinutes: 5,
        fallbackCollect: async () => {
          const data = await assembleVolumeMetric(ctxProject, input.timeRange);
          const { source, ...rest } = data;
          return { source, value: rest };
        },
      });
  const value = snapshot?.value as unknown as Omit<VolumeMetric, "source"> & { dataEmpty?: boolean };
  return {
        ...value,
        source: snapshot?.source ?? "unknown",
        lastUpdatedAt: snapshot?.collectedAt ?? null,
        meta: { source: snapshot?.source ?? "unknown", lastUpdatedAt: snapshot?.collectedAt ?? null, ttlMinutes: 5, dataEmpty: Boolean(value?.dataEmpty) },
      };
    }),

  getPrice: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
  const metricKey = `priceV2:${project.id}`;
      const snapshot = await ensureFreshSnapshot(ctxProject, metricKey, {
        ttlMinutes: 1,
        fallbackCollect: async () => {
          const data = await assemblePriceMetric(ctxProject);
          const { source, ...rest } = data;
          return { source, value: rest };
        },
      });
  const value = snapshot?.value as unknown as Omit<PriceMetric, "source">;
  return {
        ...value,
        source: snapshot?.source ?? "unknown",
        lastUpdatedAt: snapshot?.collectedAt ?? null,
        meta: { source: snapshot?.source ?? "unknown", lastUpdatedAt: snapshot?.collectedAt ?? null, ttlMinutes: 1, dataEmpty: false },
      };
    }),

  getTopHolders: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string(), limit: z.number().min(1).max(100).default(10), offset: z.number().min(0).default(0) }))
    .query(async ({ input, ctx }) => {
  const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      // Use snapshot only for default limit 10 and offset 0 to keep key simple; otherwise fetch live
      if (input.limit === 10 && input.offset === 0) {
  const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
  const metricKey = `topHoldersV2:${project.id}`;
        const snapshot = await ensureFreshSnapshot(ctxProject, metricKey, {
          ttlMinutes: 30,
          fallbackCollect: async () => {
            const res = await providerService.topHolders(project.contractAddress, project.chain, 10);
            return { source: res.source, value: { holders: res.holders } };
          },
        });
  const value = snapshot?.value as unknown as Omit<TopHoldersMetric, "source">;
  return { ...value, source: snapshot?.source ?? "unknown", lastUpdatedAt: snapshot?.collectedAt ?? null };
      }
      const res = await providerService.topHolders(project.contractAddress, project.chain, input.limit, input.offset);
      return { holders: res.holders, source: res.source, lastUpdatedAt: Date.now() } as const;
    }),

  getTransactions: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string(), timeRange: timeRangeEnum }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
  const metricKey = `transactionsV2:${project.id}:${input.timeRange}`;
      const snapshot = await ensureFreshSnapshot(ctxProject, metricKey, {
        ttlMinutes: 5,
        fallbackCollect: async () => {
          const data = await assembleTransactionsMetric(ctxProject, input.timeRange);
          const { source, ...rest } = data;
          return { source, value: rest };
        },
      });
  const value = snapshot?.value as unknown as Omit<TransactionsMetric, "source"> & { dataEmpty?: boolean };
  return {
        ...value,
        source: snapshot?.source ?? "unknown",
        lastUpdatedAt: snapshot?.collectedAt ?? null,
        meta: { source: snapshot?.source ?? "unknown", lastUpdatedAt: snapshot?.collectedAt ?? null, ttlMinutes: 5, dataEmpty: Boolean(value?.dataEmpty) },
      };
    }),

  getOverview: protectedProcedure
    .use(rateLimited)
    .input(z.object({ projectId: z.string(), timeRange: timeRangeEnum.default("7d") }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const ctxProject: ProjectContext = { id: project.id, contractAddress: project.contractAddress, chain: project.chain };
      const [holders, volume, price, tx, topHoldersSnap, liquiditySnap] = await Promise.all([
        ensureFreshSnapshot(ctxProject, `holdersV2:${project.id}:${input.timeRange}`, {
          ttlMinutes: 10,
          fallbackCollect: async () => {
            const data = await assembleHoldersMetric(ctxProject, input.timeRange);
            const { source, ...rest } = data;
            return { source, value: rest };
          },
        }),
        ensureFreshSnapshot(ctxProject, `volumeV2:${project.id}:${input.timeRange}`, {
          ttlMinutes: 5,
          fallbackCollect: async () => {
            const data = await assembleVolumeMetric(ctxProject, input.timeRange);
            const { source, ...rest } = data;
            return { source, value: rest };
          },
        }),
        ensureFreshSnapshot(ctxProject, `priceV2:${project.id}`, {
          ttlMinutes: 1,
          fallbackCollect: async () => {
            const data = await assemblePriceMetric(ctxProject);
            const { source, ...rest } = data;
            return { source, value: rest };
          },
        }),
        ensureFreshSnapshot(ctxProject, `transactionsV2:${project.id}:${input.timeRange}`, {
          ttlMinutes: 5,
          fallbackCollect: async () => {
            const data = await assembleTransactionsMetric(ctxProject, input.timeRange);
            const { source, ...rest } = data;
            return { source, value: rest };
          },
        }),
        ensureFreshSnapshot(ctxProject, `topHoldersV2:${project.id}`, {
          ttlMinutes: 30,
          fallbackCollect: async () => {
            const res = await providerService.topHolders(project.contractAddress, project.chain, 10);
            return { source: res.source, value: { holders: res.holders } };
          },
        }),
        ensureFreshSnapshot(ctxProject, `liquidityMixV2:${project.id}`, {
          ttlMinutes: 10,
          fallbackCollect: async () => {
            const res = await providerService.liquidityMix(project.contractAddress);
            return { source: res.source, value: { items: res.items } };
          },
        }),
      ]);

  type WithEmpty<T> = T & { dataEmpty?: boolean };
  const holdersVal = holders?.value as unknown as WithEmpty<Omit<HoldersMetric, "source">>;
  const volumeVal = volume?.value as unknown as WithEmpty<Omit<VolumeMetric, "source">>;
  const priceVal = price?.value as unknown as Omit<PriceMetric, "source">;
  const txVal = tx?.value as unknown as WithEmpty<Omit<TransactionsMetric, "source">>;
      // Map top holders to simple table rows expected by UI
      const topH = (topHoldersSnap?.value as unknown as { holders?: Array<{ address: string; balance: number; percentage: number; rank: number }> } | undefined)?.holders ?? [];
      const topTable = topH.map((h) => ({ Address: h.address, Balance: h.balance, Share: `${(h.percentage ?? 0).toFixed(2)}%` }));
      const liqItems = (liquiditySnap?.value as unknown as { items?: Array<{ name: string; value: number }> } | undefined)?.items ?? [];

      return {
  holders: { ...holdersVal, source: holders?.source ?? "unknown", lastUpdatedAt: holders?.collectedAt ?? null, meta: { source: holders?.source ?? "unknown", lastUpdatedAt: holders?.collectedAt ?? null, ttlMinutes: 10, dataEmpty: Boolean(holdersVal?.dataEmpty) } },
  volume: { ...volumeVal, source: volume?.source ?? "unknown", lastUpdatedAt: volume?.collectedAt ?? null, meta: { source: volume?.source ?? "unknown", lastUpdatedAt: volume?.collectedAt ?? null, ttlMinutes: 5, dataEmpty: Boolean(volumeVal?.dataEmpty) } },
  price: { ...priceVal, source: price?.source ?? "unknown", lastUpdatedAt: price?.collectedAt ?? null, meta: { source: price?.source ?? "unknown", lastUpdatedAt: price?.collectedAt ?? null, ttlMinutes: 1, dataEmpty: false } },
  transactions: { ...txVal, source: tx?.source ?? "unknown", lastUpdatedAt: tx?.collectedAt ?? null, meta: { source: tx?.source ?? "unknown", lastUpdatedAt: tx?.collectedAt ?? null, ttlMinutes: 5, dataEmpty: Boolean(txVal?.dataEmpty) } },
        // Additional sections for UI
        liquidity: liqItems,
        liquiditySource: liquiditySnap?.source ?? "unknown",
        liquidityLastUpdated: liquiditySnap?.collectedAt ?? null,
        topHolders: topTable,
        topHoldersSource: topHoldersSnap?.source ?? "unknown",
        topHoldersLastUpdated: topHoldersSnap?.collectedAt ?? null,
      };
    }),
});

export {};
