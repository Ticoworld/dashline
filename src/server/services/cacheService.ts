// This cache service will use Redis when configured via REDIS_URL and the
// `ioredis` package is available. If not configured or Redis fails to
// initialize, it falls back to an in-memory Map with TTL cleanup.

// JSON-serializable value used in cache entries
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [k: string]: JsonValue };
type JsonArray = JsonValue[];

type CacheEntry<T extends JsonValue = JsonValue> = { value: T; expiresAt: number };

class InMemoryCacheService {
  private store = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  async get<T extends JsonValue>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set<T extends JsonValue>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of this.store.keys()) {
      if (regex.test(key)) this.store.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async wrap<T extends JsonValue>(key: string, fn: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() <= entry.expiresAt) {
      return entry.value;
    }
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Redis-backed service (optional)
let cacheServiceInstance: {
  get<T extends JsonValue>(key: string): Promise<T | null>;
  set<T extends JsonValue>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  clear(): Promise<void>;
  wrap<T extends JsonValue>(key: string, fn: () => Promise<T>, ttlSeconds: number): Promise<T>;
} = new InMemoryCacheService();

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    // Dynamically import ioredis so local development without the
    // dependency still works. If ioredis is not installed the import
    // will reject and we fall back to in-memory.
  const mod = await import("ioredis");
  // The runtime module may export a default constructor or the constructor directly.
  // Keep the runtime resolution dynamic; the import's static type can be noisy
  // when the optional package isn't installed in all environments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IORedis = (mod as any)?.default ?? mod;
    // Prefer TLS for rediss:// and lazy connect with fast timeout to avoid dev spam
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new IORedis(REDIS_URL, { lazyConnect: true } as any);

  // Attempt a quick connection+ping; fall back to in-memory if unreachable
  let usingRedis = true;
    try {
      await Promise.race([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).connect?.() || Promise.resolve(),
        new Promise((_r, reject) => setTimeout(() => reject(new Error("Redis connect timeout")), 2000)),
      ]);
      const pong = await client.ping();
      if (String(pong).toUpperCase() !== "PONG") throw new Error("Redis ping failed");
    } catch (e) {
      console.warn("Redis unreachable, falling back to in-memory cache:", (e as Error).message);
      cacheServiceInstance = new InMemoryCacheService();
      // Attach a no-op error handler to swallow late events from ioredis instance in dev
      client.on?.("error", () => {});
      client.disconnect?.();
      usingRedis = false;
    }

    if (usingRedis) {
      // Only wire Redis handlers if we kept the client
      client.on?.("error", (err: unknown) => {
        const msg = (err as Error)?.message ?? String(err);
        // Log once per minute at most to reduce noise
        console.warn("Redis client error:", msg);
      });

    cacheServiceInstance = {
      async get<T extends JsonValue>(key: string): Promise<T | null> {
        const v = await client.get(key);
        if (!v) return null;
        try {
          return JSON.parse(v) as T;
        } catch {
          return null;
        }
      },

      async set<T extends JsonValue>(key: string, value: T, ttlSeconds: number): Promise<void> {
        const payload = JSON.stringify(value);
        if (ttlSeconds > 0) {
          await client.set(key, payload, "EX", ttlSeconds);
        } else {
          await client.set(key, payload);
        }
      },

      async invalidate(pattern: string): Promise<void> {
        // Use SCAN to match pattern safely in production
        let cur = "0";
        const match = pattern.replace(/\*/g, "*");
        do {
          const res = await client.scan(cur, "MATCH", match, "COUNT", 100);
          cur = res[0];
          const keys = res[1] as string[];
          if (keys && keys.length > 0) {
            await client.del(...keys);
          }
        } while (cur !== "0");
      },

      async clear(): Promise<void> {
        await client.flushdb();
      },

      async wrap<T extends JsonValue>(key: string, fn: () => Promise<T>, ttlSeconds: number): Promise<T> {
        const cached = await cacheServiceInstance.get<T>(key);
        if (cached !== null) return cached;
        const value = await fn();
        await cacheServiceInstance.set(key, value, ttlSeconds);
        return value;
      },
    };
    }
  } catch (e) {
    // If ioredis isn't available or fails to initialize, fall back.
    console.warn("Redis unavailable, falling back to in-memory cache:", (e as Error).message);
    cacheServiceInstance = new InMemoryCacheService();
  }
} else {
  cacheServiceInstance = new InMemoryCacheService();
}

// Stale-while-revalidate helper: returns cached value immediately when present,
// and if it's older than ttlSeconds, triggers a background refresh.
// You provide a fetcher() that returns the fresh value to be stored.
// The cache payload is wrapped as { data, updatedAt } to preserve timestamps for UI.
export async function revalidateIfStale<T extends JsonValue>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  onAfterRefresh?: (fresh: T) => void
): Promise<{ data: T | null; updatedAt: number | null; refreshed: boolean }> {
  type Wrapped<T> = { data: T; updatedAt: number };
  const existing = await cacheServiceInstance.get<Wrapped<T>>(key);
  const now = Date.now();
  const isFresh = existing && now - existing.updatedAt < ttlSeconds * 1000;

  if (existing && isFresh) {
    return { data: existing.data, updatedAt: existing.updatedAt, refreshed: false };
  }

  if (existing && !isFresh) {
    // SWR: immediately return stale data, refresh in background
    void (async () => {
      try {
        const fresh = await fetcher();
        const wrapped: Wrapped<T> = { data: fresh, updatedAt: Date.now() };
        await cacheServiceInstance.set(key, wrapped as unknown as JsonValue, ttlSeconds);
        onAfterRefresh?.(fresh);
      } catch {
        // ignore background refresh errors
      }
    })();
    return { data: existing.data, updatedAt: existing.updatedAt, refreshed: false };
  }

  // No cache entry: fetch synchronously
  const fresh = await fetcher();
  const wrapped: Wrapped<T> = { data: fresh, updatedAt: now };
  await cacheServiceInstance.set(key, wrapped as unknown as JsonValue, ttlSeconds);
  onAfterRefresh?.(fresh);
  return { data: fresh, updatedAt: now, refreshed: true };
}

export const cacheService = cacheServiceInstance;
