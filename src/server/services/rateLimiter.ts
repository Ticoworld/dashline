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

const DEFAULTS: Record<RateKey, Pick<Bucket, "capacity" | "refillRatePerSec" | "concurrency">> = {
  dexscreener: { capacity: 60, refillRatePerSec: 60 / 60, concurrency: 6 },
  coingecko: { capacity: 50, refillRatePerSec: 50 / 60, concurrency: 5 },
  dune: { capacity: 5, refillRatePerSec: 5 / 60, concurrency: 2 },
  bitquery: { capacity: 5, refillRatePerSec: 5 / 60, concurrency: 2 },
  moralis: { capacity: 10, refillRatePerSec: 10 / 60, concurrency: 2 },
};

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
