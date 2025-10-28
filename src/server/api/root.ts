import { mergeRouters, router } from "./trpc";
import { projectRouter } from "./routers/project";
import { metricsRouter } from "./routers/metrics";
import { userRouter } from "./routers/user";
import { notificationsRouter } from "./routers/notifications";
import { walletRouter } from "./routers/wallet";

export const appRouter = mergeRouters(
  router({
    project: projectRouter,
    metrics: metricsRouter,
    user: userRouter,
  wallet: walletRouter,
  notifications: notificationsRouter,
  })
);

export type AppRouter = typeof appRouter;
