type CBState = { failures: number; openedAt: number | null };

const store = new Map<string, CBState>();

const REDIS_URL = process.env.REDIS_URL;
let redis: null | { incr: (k: string) => Promise<number>; get: (k: string) => Promise<string | null>; set: (k: string, v: string, mode?: string, ttl?: number) => Promise<unknown>; del: (k: string) => Promise<number> } = null;

async function ensureRedis() {
  if (!REDIS_URL) return null;
  if (redis) return redis;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("ioredis");
    const IORedis = mod?.default ?? mod;
    const client = new IORedis(REDIS_URL);
    redis = client as unknown as typeof redis;
    return redis;
  } catch {
    return null;
  }
}

function openKey(key: string) {
  return `cb:${key}:open`;
}

function failKey(key: string) {
  return `cb:${key}:failures`;
}

export async function isOpen(key: string, openWindowMs = 60_000) {
  const r = await ensureRedis();
  if (r) {
    const val = await (r as NonNullable<typeof redis>).get(openKey(key));
    return Boolean(val);
  }
  const s = store.get(key) ?? { failures: 0, openedAt: null };
  if (s.openedAt) {
    if (Date.now() - s.openedAt > openWindowMs) {
      store.set(key, { failures: 0, openedAt: null });
      return false;
    }
    return true;
  }
  return false;
}

export async function recordFailure(key: string, failureThreshold = 5, openWindowMs = 60_000) {
  const r = await ensureRedis();
  if (r) {
    const count = await (r as NonNullable<typeof redis>).incr(failKey(key));
    if (count >= failureThreshold) {
      await (r as NonNullable<typeof redis>).set(openKey(key), "1", "PX", openWindowMs);
      await (r as NonNullable<typeof redis>).del(failKey(key));
    }
    return;
  }
  const s = store.get(key) ?? { failures: 0, openedAt: null };
  s.failures += 1;
  if (s.failures >= failureThreshold && !s.openedAt) {
    s.openedAt = Date.now();
  }
  store.set(key, s);
}

export async function recordSuccess(key: string) {
  const r = await ensureRedis();
  if (r) {
    await (r as NonNullable<typeof redis>).del(openKey(key));
    await (r as NonNullable<typeof redis>).del(failKey(key));
    return;
  }
  store.set(key, { failures: 0, openedAt: null });
}

export async function resetBreaker(key: string) {
  const r = await ensureRedis();
  if (r) {
    await (r as NonNullable<typeof redis>).del(openKey(key));
    await (r as NonNullable<typeof redis>).del(failKey(key));
    return;
  }
  store.delete(key);
}

// Named exports updated to async versions.
