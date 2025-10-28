type Counters = { [k: string]: number };
const counters: Counters = {};

const REDIS_URL = process.env.REDIS_URL;
let redis: null | { incrby: (k: string, by: number) => Promise<number>; get: (k: string) => Promise<string | null>; del: (k: string) => Promise<number>; scan: (cur: string, ...args: Array<string | number>) => Promise<[string, string[]]> } = null;

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

function redisKey(key: string) {
  return `metrics:${key}`;
}

export const metrics = {
  inc(key: string, by = 1) {
    counters[key] = (counters[key] || 0) + by;
    // fire-and-forget update to Redis if available
    void ensureRedis().then((r) => {
      if (!r) return;
  (r as NonNullable<typeof redis>).incrby(redisKey(key), by).catch(() => void 0);
    });
  },
  get(key: string) {
    return counters[key] || 0;
  },
  reset(key?: string) {
    if (key) {
      delete counters[key];
      void ensureRedis().then((r) => {
        if (!r) return;
  (r as NonNullable<typeof redis>).del(redisKey(key)).catch(() => void 0);
      });
    } else {
      Object.keys(counters).forEach((k) => delete counters[k]);
      void ensureRedis().then(async (r) => {
        if (!r) return;
        try {
          let cur = "0";
          do {
            const res = await (r as NonNullable<typeof redis>).scan(cur, "MATCH", "metrics:*", "COUNT", 100);
            cur = res[0];
            const keys = res[1];
            if (keys && keys.length > 0) {
              for (const k of keys) {
                await (r as NonNullable<typeof redis>).del(k);
              }
            }
          } while (cur !== "0");
        } catch {
          // ignore
        }
      });
    }
  },
  async snapshot(): Promise<Record<string, number>> {
    const snap: Record<string, number> = { ...counters };
    const r = await ensureRedis();
    if (!r) return snap;
    try {
      let cur = "0";
      do {
        const res = await (r as NonNullable<typeof redis>).scan(cur, "MATCH", "metrics:*", "COUNT", 200);
        cur = res[0];
        const keys = res[1];
        if (keys && keys.length > 0) {
          // fetch values in batches
          for (const k of keys) {
            const v = await (r as NonNullable<typeof redis>).get(k);
            const num = v ? Number(v) : 0;
            const name = k.replace(/^metrics:/, "");
            snap[name] = num;
          }
        }
      } while (cur !== "0");
    } catch {
      // ignore redis snapshot errors, return memory snapshot
    }
    return snap;
  },
};

export default metrics;
