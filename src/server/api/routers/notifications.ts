import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/api/trpc";
import { prisma } from "@/server/db";

export const notificationsRouter = router({
  // Returns a simple unread count based on new MetricSnapshots since a provided timestamp
  // This leverages existing data without adding a new table. Clients can manage a local
  // "last read" time in localStorage and pass it here.
  getUnreadCount: protectedProcedure
    .input(
      z
        .object({
          since: z.string().datetime().optional(), // ISO timestamp
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Default window: last 24 hours if not provided
      const sinceDate = input?.since ? new Date(input.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Fetch user's active project IDs
      const projects = await prisma.project.findMany({
        where: { userId, isActive: true },
        select: { id: true },
      });
      if (projects.length === 0) return { count: 0 };
      const projectIds = projects.map((p) => p.id);

      // Count new metric snapshots across the user's projects
      const count = await prisma.metricSnapshot.count({
        where: {
          projectId: { in: projectIds },
          createdAt: { gt: sinceDate },
        },
      });

      return { count };
    }),
});

export type NotificationsRouter = typeof notificationsRouter;
