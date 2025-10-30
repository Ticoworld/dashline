import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/server/db";
import { protectedProcedure, router } from "@/server/api/trpc";
import { dexscreenerService } from "@/server/services/dexscreenerService";
import { upsertTokenForIndexing } from "@/server/services/indexerService";
import { getAddress } from "ethers";

const connectInput = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid contract address"),
  chain: z.string().min(2),
});

export async function handleProjectConnect(input: z.infer<typeof connectInput>, ctx: { userId?: string }) {
  const { userId } = ctx as { userId?: string };
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  // Resolve real metadata from Dexscreener; fallback to basic labels if unavailable
  let meta: { name: string; symbol: string; tokenStandard: string; logoUrl?: string; description?: string };
  try {
    const m = await dexscreenerService.getTokenMetadata(input.contractAddress, input.chain);
    meta = { name: m.name, symbol: m.symbol, tokenStandard: "ERC20", logoUrl: m.logoUrl };
  } catch {
    meta = { name: "Token", symbol: "TKN", tokenStandard: "ERC20" };
  }

  let checksum: string;
  try {
    checksum = getAddress(input.contractAddress);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid contract address" });
  }

  const existing = await prisma.project.findFirst({ where: { userId, contractAddressChecksum: checksum, chain: input.chain } });
  if (existing) {
    return { projectId: existing.id, name: existing.name, symbol: existing.symbol, logoUrl: existing.logoUrl ?? undefined };
  }

  const project = await prisma.project.create({
    data: {
      userId,
      contractAddress: input.contractAddress,
      contractAddressChecksum: checksum,
      chain: input.chain,
      name: meta.name,
      symbol: meta.symbol,
      tokenStandard: meta.tokenStandard,
      logoUrl: meta.logoUrl ?? null,
      description: meta.description ?? null,
    },
  });

  // Attempt server-side token upsert to enqueue indexing. Non-blocking: errors are logged and returned as warnings.
  try {
    await upsertTokenForIndexing({ contractAddress: input.contractAddress, chain: input.chain });
  } catch (err) {
    console.error("upsertTokenForIndexing failed", err);
    // Do not throw - return project result with a non-fatal warning
    return { projectId: project.id, name: project.name, symbol: project.symbol, logoUrl: project.logoUrl ?? undefined, tokenRegistered: false, tokenRegisterReason: String(err) };
  }

  return { projectId: project.id, name: project.name, symbol: project.symbol, logoUrl: project.logoUrl ?? undefined, tokenRegistered: true };
}

export const projectRouter = router({
  connect: protectedProcedure.input(connectInput).mutation(async ({ input, ctx }) => {
    return handleProjectConnect(input, ctx);
  }),

  list: protectedProcedure
    .input(z.object({ page: z.number().min(1).optional(), limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 12;
      const offset = (page - 1) * limit;
      const [projects, total] = await Promise.all([
        prisma.project.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
        prisma.project.count({ where: { userId, isActive: true } }),
      ]);
      return { projects, total };
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string() }))
  .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return { project };
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
  .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.updateMany({ where: { id: input.projectId, userId }, data: { isActive: false } });
      if (project.count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        data: z
          .object({ name: z.string().min(1).optional(), description: z.string().max(2048).optional(), logoUrl: z.string().url().optional() })
          .strict(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const project = await prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const updated = await prisma.project.update({ where: { id: input.projectId }, data: { ...input.data } });
      return { project: updated };
    }),
  restore: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const project = await prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const restored = await prisma.project.update({ where: { id: input.projectId }, data: { isActive: true } });
      return { project: restored };
    }),
});
