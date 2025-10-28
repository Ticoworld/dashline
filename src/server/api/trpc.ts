import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { auth } from "@clerk/nextjs/server";
import { resolveOrCreateUserFromClerk } from "@/server/services/userBootstrap";

export type UserCtx = {
  userId: string | null;
  ip: string | null;
};

// Accept an options bag so the fetch adapter can forward the incoming Request
// to Clerk's server auth helper. Backwards-compatible: callers may call with
// no args and auth() will still work.
export const createTRPCContext = async (opts?: { req?: Request }): Promise<UserCtx> => {
  // Dev bypass: allow protected procedures locally without signing in.
  // This mirrors the dashboard layout bypass and is guarded to non-prod only.
  if (process.env.NODE_ENV !== "production" && process.env.DASHLINE_DEV_BYPASS_AUTH === "1") {
    const ip = opts?.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || opts?.req?.headers.get("x-real-ip") || null;
    return { userId: "dev-user", ip };
  }

  // Clerk's `auth` helper will read auth from the server environment
  // (cookies/headers). In most Next.js server runtimes calling `auth()`
  // without arguments is sufficient; forwarding Request directly is
  // opt-in and unsupported by the current types here, so keep the
  // call simple and extract the `userId` when available.
  const authResult = await auth();
  const clerkId = (authResult as { userId?: string | null } | undefined)?.userId ?? null;
  const ip = opts?.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || opts?.req?.headers.get("x-real-ip") || null;
  if (!clerkId) return { userId: null, ip };
  // Ensure an internal user exists and return its id for downstream Prisma calls
  const internalId = await resolveOrCreateUserFromClerk(clerkId);
  return { userId: internalId, ip };
};

const t = initTRPC.context<UserCtx>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

export const protectedProcedure = t.procedure.use(
  middleware(async ({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({ ctx: { userId: ctx.userId, ip: ctx.ip ?? null } });
  })
);

// Rate limiter: prefer Redis fixed-window counter when REDIS_URL is set and ioredis is available;
// otherwise fall back to in-memory token bucket.
type Bucket = { tokens: number; updatedAt: number };
const memBuckets = new Map<string, Bucket>();
// More generous defaults in development to avoid throttling dashboard loads
const RATE_LIMIT_TOKENS = Number(
  process.env.RATE_LIMIT_TOKENS ?? (process.env.NODE_ENV === "production" ? 120 : 2000)
); // requests per window
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000); // per minute
const REDIS_URL = process.env.REDIS_URL;
let redisClient: unknown | null = null;

type Redisish = { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<number | void> } | null;

async function getRedis(): Promise<Redisish> {
  if (!REDIS_URL) return null;
  if (redisClient) return redisClient as { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<number | void> };
  try {
    // dynamic import to keep optional
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("ioredis");
    const IORedis = mod?.default ?? mod;
    redisClient = new IORedis(REDIS_URL);
    return redisClient as { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<number | void> };
  } catch {
    return null;
  }
}

function memConsume(userKey: string, now = Date.now()) {
  const refillPerMs = RATE_LIMIT_TOKENS / RATE_LIMIT_WINDOW_MS;
  const b = memBuckets.get(userKey) ?? { tokens: RATE_LIMIT_TOKENS, updatedAt: now };
  const elapsed = now - b.updatedAt;
  const refilled = Math.min(RATE_LIMIT_TOKENS, b.tokens + elapsed * refillPerMs);
  const nextTokens = refilled - 1;
  if (nextTokens < 0) return false;
  memBuckets.set(userKey, { tokens: nextTokens, updatedAt: now });
  return true;
}

export const rateLimited = middleware(async ({ ctx, next }) => {
  const idOrIp = ctx.userId ?? ctx.ip ?? "anon";
  const redis = await getRedis();
  if (redis) {
    const key = `rate:${idOrIp}`;
    try {
      const count: number = await (redis as NonNullable<Redisish>).incr(key);
      if (count === 1) {
        await (redis as NonNullable<Redisish>).expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      if (count > RATE_LIMIT_TOKENS) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      // If Redis errors, fall back to memory
      if (!memConsume(idOrIp)) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    }
  } else {
    if (!memConsume(idOrIp)) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
  }
  return next();
});
