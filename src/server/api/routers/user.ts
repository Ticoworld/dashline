import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { prisma } from "@/server/db";

export const userRouter = router({
  getSettings: protectedProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      return { settings };
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        settings: z.object({
          theme: z.string().optional(),
          emailNotifications: z.boolean().optional(),
          weeklyDigest: z.boolean().optional(),
          defaultTimeRange: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const settings = await prisma.userSettings.upsert({
        where: { userId },
        update: { ...input.settings },
        create: { userId, ...input.settings },
      });
      return { settings };
    }),

  getUsage: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      // For MVP, compute counts; in production, derive periodStart dynamically
      const projectsUsed = await prisma.project.count({ where: { userId, isActive: true } });
      const plan = user.plan;
      const limits = plan === "FREE" ? { apiCallsLimit: 1000, projectsLimit: 2 } : plan === "PRO" ? { apiCallsLimit: 100000, projectsLimit: 10 } : { apiCallsLimit: 1000000, projectsLimit: 100 };
      const currentPeriodStart = new Date();
      currentPeriodStart.setDate(1);
      const apiUsage = await prisma.apiUsage.findMany({ where: { userId, periodStart: { gte: currentPeriodStart } } });
  const apiCallsUsed = apiUsage.reduce((sum: number, u: { requestCount: number }) => sum + u.requestCount, 0);
      return { plan, apiCallsUsed, apiCallsLimit: limits.apiCallsLimit, projectsUsed, projectsLimit: limits.projectsLimit };
    }),
});
