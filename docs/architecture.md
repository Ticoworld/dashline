# Dashline Data Architecture (Updated)

## Provider priorities

- Holders (total, top list, history):
  1) Bitquery GraphQL
  2) Moralis holders API
  3) Covalent (with explicit pagination across pages, never rely on 100-page default)

- Trading volume (historical): The Graph (Uniswap v2/v3 token day data). Fallback to Bitquery DEX trades if needed. Dexscreener is used only for near real-time 24h stats and liquidity mix visuals.

- On-chain truths: decimals, totalSupply, balanceOf via ethers over public RPC or ALCHEMY_KEY / INFURA_KEY / QUICKNODE_RPC when configured.

## Caching and snapshots

Layers: in-memory SWR -> Redis (optional) -> Postgres snapshots via Prisma `MetricSnapshot`.

- Schema fields: id, projectId, metric, value (json), source, dataEmpty (boolean), ttlMinutes, collectedAt, expiresAt, createdAt.
- TTLs:
  - Price: 1–5 min
  - 24h Volume snapshot: 5–10 min
  - Holders & Holder growth: 30–60 min (daily snapshots persisted)

Rules:
- Do not cache empty arrays from a provider as valid data. Treat as failure and attempt fallback. If all fail, persist a synthetic series and set dataEmpty=true.
- Snapshots are deduplicated per (projectId, metric) with an upsert. `ensureFreshSnapshot` handles SWR-like refresh.

## API surface

Routers return a backwards-compatible shape with top-level fields (e.g., `totalHolders`, `chartData`) and an additional `meta` object:

```
{
  data: { ... }, // not always present on all endpoints; top-level fields preserved
  meta: { source, lastUpdatedAt, ttlMinutes, dataEmpty }
}
```

UI displays data provenance and a subtle synthetic badge when `dataEmpty` is true.

## Rate limiting and telemetry

- Token-bucket rate limiter per provider with simple concurrency bounds (see `rateLimiter.ts`).
- Per-request counters in `observability.ts`. A basic admin view is available at `/dashboard/admin/providers` showing provider error counts and call volumes.

## Secrets and configuration

Supply the following in `.env`:

- BITQUERY_API_KEY
- MORALIS_API_KEY
- COVALENT_API_KEY
- DUNE_API_KEY (optional)
- ALCHEMY_KEY / INFURA_KEY / QUICKNODE_RPC / PUBLIC_RPC_URL (one or more)

When keys are missing, the system operates in a degraded but transparent mode, surfacing a "limited by provider" badge where relevant.

# Dashline Architecture — Caching, Data Pipeline, and Reliability Layer

_Last updated: October 2025_

---

## 1. Overview

Dashline is a **no-code Web3 analytics dashboard** providing instant insights from wallet or contract addresses.  
Unlike Dune, which relies on user-written SQL, Dashline aggregates verified data from APIs (Covalent, DEXScreener, CoinGecko, optional Dune Presets) and displays curated KPIs automatically.

### Core Goals
- **Instant insights** (under 15 seconds after connect)
- **Reliable metrics** with smart caching
- **Graceful degradation** if any source fails
- **Scalable API usage** within quota limits
- **No-code simplicity** with Vercel-level UX polish

---

## 2. Data Flow Overview

User → Dashboard UI → TRPC API → Data Service Layer → Cache (Redis/Supabase KV) →
API Provider (Covalent / DEXScreener / CoinGecko / Dune Preset)

markdown
Copy code

### Key Components
- **Frontend:** Next.js + React + Tailwind (minimal UI)
- **Backend:** TRPC API routes for metrics
- **DB Layer:** Supabase (Postgres) for persistent storage & snapshots
- **Cache Layer:** Redis or Supabase KV for short-term caching
- **Job Queue:** Upstash QStash / Supabase Cron for background refresh & snapshots

---

## 3. Caching Strategy

| Metric | Source Priority | TTL (min) | Refresh Mode | Fallback |
|---------|-----------------|-----------|---------------|-----------|
| **Price / 24h Volume** | DEXScreener → CoinGecko → Dune | 5 | Real-time (every call) | Cached JSON |
| **Holders Count / Growth** | Covalent → Bitquery → Dune | 60 | Async refresh | Cached Snapshot |
| **Tx Count / Activity** | Covalent → Moralis → Dune | 60 | Async refresh | Cached Snapshot |
| **Top Holders** | Covalent → Bitquery | 180 | Manual refresh | Last snapshot |
| **Protocol Revenue / Liquidity** | Dune Preset | 180 | Async | Stale OK |

### Cache Schema (Redis / Supabase KV)

```ts
cache_metrics: {
  key: string,          // e.g. holders:0xabc123:30d
  data: jsonb,          // serialized metric data
  source: string,       // covalent | dexscreener | coingecko | dune
  updated_at: timestamptz,
  ttl_minutes: int
}
Cache Logic
ts
Copy code
if (cache.exists(key) && cache.isFresh(key)) {
  return cache.data;
} else {
  queueRefresh(key);
  return cache.data || { status: "loading" };
}
4. Persistent Snapshots
Table: metric_snapshots
Field	Type	Description
contract_address	text	Target contract
metric_type	text	holders / volume / txs
  3) Synthetic (with explicit pagination across pages, never rely on 100-page default)
value	numeric	Metric value
collected_at	timestamptz	Timestamp
Background Jobs
Job	Frequency	Purpose
refresh-realtime-metrics	every 5–10 min	Refresh price/volume
refresh-snapshots	hourly	Update holders/txs
nightly-rollup	00:00 UTC	Store 24 h aggregates in metric_snapshots
purge-stale-cache	hourly	Remove expired cache entries

5. Rate Limit & Fallback Strategy
Rate control: token-bucket limiter per provider (e.g., 5 req/sec per API key)

Queue system: p-limit or bullmq for request scheduling

Provider fallback chain:

For each metric, define ordered provider priority list.

If a call fails or quota exceeded → next provider.

ts
Copy code
{
  holders: ["covalent", "bitquery", "dune"],
  volume: ["dexscreener", "coingecko", "dune"],
6. Dashboard Experience Enhancements
Global time selector (applies to all charts)

Guaranteed two populated charts on first connect


Single input UX: user pastes contract/wallet → auto-detect type

7. Monitoring & Metrics
Track:

API call counts per provider
Cache hit ratio

Avg response latency

API error rate

Snapshot freshness (Δtime since last update)
Shared Redis + API quotas
Cron jobs handle light refresh

Medium-term
Onboard paid API tiers (Covalent Pro, Dune API)

Add internal proxy layer with rotating keys

This reduces dependence on external rate-limited APIs over time.
9. Summary
Goal	Approach
Reduce API load	Smart caching + queued refresh
Improve reliability	Multi-source fallback + snapshot store
Speed up UI	Cache-first rendering
Preserve simplicity	One input → instant insights
Enable scale	Background jobs + nightly rollups
Long-term autonomy	Gradual move to Dashline-owned mini data layer

10. Next Steps
Implement caching utilities + Redis connector.

Set up Supabase tables (cache_metrics, metric_snapshots).

Add background jobs (cron or QStash).

Refactor TRPC services to use cache-first logic.

Merge per-card time controls → single global selector.

Test with at least two sample addresses (DeFi + NFT).