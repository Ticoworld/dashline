// Simple token bucket + concurrency limiter for external providers
// No external deps. Intended to avoid exhausting API rate limits.

export type RateKey = "dexscreener" | "coingecko" | "dune" | "bitquery" | "moralis";

type Bucket = {
  capacity: number; // max tokens
  tokens: number; // current tokens
  refillRatePerSec: number; // tokens per second
  lastRefill: number; // ms
  concurrency: number; // max concurrent executions
  inFlight: number;
  queue: Array<() => void>;
};

// Base defaults
const BASE_DEFAULTS: Record<RateKey, Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">> = {
  dexscreener: { capacity: 60, refillRatePerSec: 60 / 60, concurrency: 6 },
  coingecko: { capacity: 50, refillRatePerSec: 50 / 60, concurrency: 5 },
  dune: { capacity: 5, refillRatePerSec: 5 / 60, concurrency: 2 },
  bitquery: { capacity: 5, refillRatePerSec: 5 / 60, concurrency: 2 },
  moralis: { capacity: 10, refillRatePerSec: 10 / 60, concurrency: 2 },
};

function devAdjustedDefaults(): typeof BASE_DEFAULTS {
  // In non-production, allow faster Moralis to improve first render speed unless explicitly overridden via env
  if (process.env.NODE_ENV === "production") return BASE_DEFAULTS;
  return {
    ...BASE_DEFAULTS,
    moralis: { capacity: 60, refillRatePerSec: 60 / 60, concurrency: 4 },
  };
}

function envOverride(key: RateKey, base: Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">) {
  const upper = key.toUpperCase();
  const cap = Number(process.env[`RATE_${upper}_CAPACITY` as keyof NodeJS.ProcessEnv] ?? NaN);
  const refillPerMin = Number(process.env[`RATE_${upper}_REFILL_PER_MIN` as keyof NodeJS.ProcessEnv] ?? NaN);
  const conc = Number(process.env[`RATE_${upper}_CONCURRENCY` as keyof NodeJS.ProcessEnv] ?? NaN);
  const refillRatePerSec = Number.isFinite(refillPerMin) && refillPerMin > 0 ? refillPerMin / 60 : base.refillRatePerSec;
  return {
    capacity: Number.isFinite(cap) && cap > 0 ? cap : base.capacity,
    refillRatePerSec,
    concurrency: Number.isFinite(conc) && conc > 0 ? conc : base.concurrency,
  } as Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">;
}

const DEFAULTS: Record<RateKey, Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">> = (() => {
  const d = devAdjustedDefaults();
  const out: Record<RateKey, Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">> = {
    dexscreener: envOverride("dexscreener", d.dexscreener),
    coingecko: envOverride("coingecko", d.coingecko),
    dune: envOverride("dune", d.dune),
    bitquery: envOverride("bitquery", d.bitquery),
    moralis: envOverride("moralis", d.moralis),
  };
  return out;
})();

const buckets = new Map<RateKey, Bucket>();

function getBucket(key: RateKey): Bucket {
  let b = buckets.get(key);
  if (!b) {
    const d = DEFAULTS[key];
    b = {
      capacity: d.capacity,
      tokens: d.capacity,
      refillRatePerSec: d.refillRatePerSec,
      lastRefill: Date.now(),
      concurrency: d.concurrency,
      inFlight: 0,
      queue: [],
    };
    buckets.set(key, b);
  }
  return b;
}

function refill(b: Bucket) {
  const now = Date.now();
  const elapsed = (now - b.lastRefill) / 1000;
  if (elapsed <= 0) return;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRatePerSec);
  b.lastRefill = now;
}

export async function withRateLimit<T>(key: RateKey, fn: () => Promise<T>): Promise<T> {
  const b = getBucket(key);

  return new Promise<T>((resolve, reject) => {
    const tryStart = () => {
      refill(b);
      if (b.inFlight >= b.concurrency) {
        b.queue.push(tryStart);
        return;
      }
      if (b.tokens < 1) {
        // schedule when tokens likely available
        const waitMs = Math.max(100, Math.ceil(((1 - b.tokens) / b.refillRatePerSec) * 1000));
        setTimeout(tryStart, waitMs);
        return;
      }
      b.tokens -= 1;
      b.inFlight += 1;
      fn()
        .then((v) => resolve(v))
        .catch((e) => reject(e))
        .finally(() => {
          b.inFlight -= 1;
          const next = b.queue.shift();
          if (next) setTimeout(next, 0);
        });
    };
    tryStart();
  });
}
