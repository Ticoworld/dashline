# Dashline

## Project Summary
Dashline is a Next.js App Router application with a tRPC API and Prisma/Postgres persistence for token-focused dashboard analytics.  
It also includes a separate indexer worker that scans ERC-20 `Transfer` logs and stores indexed transfer data in the database.

## Problem Solved
The repository implements a flow where a user can connect a contract and view dashboard metrics (holders, volume, price, transactions, top holders, liquidity mix) without manually writing data queries.  
The backend combines provider fallbacks and snapshot caching to keep responses available when providers fail.

## Features
- Authenticated dashboard routes via Clerk middleware and protected tRPC procedures.
- Project connect/list/get/update/delete/restore flows.
- Dashboard metric endpoints: holders, volume, price, transactions, top holders, and overview aggregation.
- Snapshot persistence and stale-while-refresh behavior for metric data (`MetricSnapshot`).
- Provider integrations with fallback behavior (CoinGecko, Dexscreener, Moralis, The Graph, Dune placeholders).
- Token registration endpoint for indexing and token status/progress endpoints.
- Token admin endpoints (`pause`, `resume`, `reindex`, `reset`) with admin-key check logic.
- Standalone indexer process for block-range scanning and transfer ingestion.
- Operational endpoints: health check, internal metrics JSON, Prometheus-style metrics text.

## Stack
- Runtime/framework: Next.js 15, React 19, TypeScript
- API layer: tRPC 11
- Database: PostgreSQL + Prisma
- Auth: Clerk
- Data/providers: ethers, axios, CoinGecko, Dexscreener, Moralis, Bitquery service code, The Graph, Etherscan, Dune service
- Caching/limits: in-memory cache, optional Redis (`ioredis`), custom rate limit/circuit breaker modules
- Worker: `tsx`-run indexer with `p-queue`
- Testing/linting: Vitest, ESLint, TypeScript typecheck
- Styling/charts: Tailwind CSS 4, Recharts

## Setup
### Prerequisites
- Node.js (CI uses Node 20)
- PostgreSQL
- Optional Redis

### 1) Install dependencies
```bash
npm ci
```

### 2) Configure environment
There is currently no committed `.env.example` file. Create `.env.local` (or `.env`) manually.

Minimum required by environment validation:
- `DATABASE_URL`

Commonly used variables in this repo:
- Auth/app: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`
- Providers: `DUNE_API_KEY`, `BITQUERY_API_KEY`, `MORALIS_API_KEY`, `ETHERSCAN_API_KEY`
- RPC: `RPC_URLS`/`RPC_URL`, `QUICKNODE_RPC`, `ALCHEMY_KEY`, `INFURA_KEY`, `PUBLIC_RPC_URL`
- Cache/ops: `REDIS_URL`, `METRICS_TOKEN`, `INTERNAL_CRON_SECRET`, `ADMIN_KEY`
- Indexer tuning: `BATCH_BLOCKS`, `POLL_INTERVAL_MS`, `INDEXER_CONCURRENCY`, `REORG_SAFETY_BLOCKS`, `FAST_PASS_DAYS`

### 3) Start local infrastructure (optional helper)
```bash
docker compose up -d
```
This repository includes `db` (Postgres 16) and `redis` services in `docker-compose.yml`.

### 4) Prisma generate, migrate, seed
```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

### 5) Run the app
```bash
npm run dev
```

### 6) Run the indexer worker (separate process)
```bash
npm run indexer:dev
```

### 7) Quality checks
```bash
npm run lint
npm run typecheck
npm run test
npm run smoke
```

## Repository Structure
```text
src/
  app/                    # Next.js routes, pages, API route handlers
  server/
    api/                  # tRPC router/context/procedures
    services/             # Provider orchestration, caching, snapshots, metrics assembly
  services/indexer/       # Standalone transfer indexer worker
  components/             # UI, charts, dashboard/layout components
  lib/                    # Shared client/server utilities
  context/, hooks/, types/
prisma/
  schema.prisma           # Data model
  migrations/             # SQL migrations
  seed.js                 # Seed script
scripts/                  # Operational/maintenance scripts
tests/                    # Vitest suites
docs/                     # Architecture/environment docs
```

## Architecture Overview
### Request/data path
1. UI calls tRPC procedures from dashboard pages.
2. tRPC resolves authenticated user context.
3. Metric router attempts fresh snapshot retrieval.
4. If stale/missing, orchestrator assembles metrics via provider service.
5. Result is persisted/upserted into `MetricSnapshot`.
6. Response includes source/timestamp metadata for UI display.

### Indexing path
1. Contract registration endpoint upserts token indexing record.
2. Indexer polls for `pending`/`syncing` tokens.
3. Scanner fetches `Transfer` logs for block ranges.
4. Transfers are inserted; token scan checkpoint/status are updated.
5. Status/progress endpoints expose indexing state to UI/admin.

## Deployment / Runtime Notes
- The web app and indexer are separate processes. `next start` does not run the indexer.
- API routes in this repository are explicitly configured for Node.js runtime in multiple handlers.
- CI workflow runs on GitHub Actions: install, lint, Prisma generate/migrate/seed, normalization scripts, smoke build, and tests.
- Base URL logic checks `VERCEL_URL` for server-side tRPC URL resolution. *(Partially inferred: this indicates Vercel-targeted deployment support, but no full platform deployment manifest is committed.)*

## Limitations (Confirmed)
- Several dashboard areas are partial or placeholder implementations:
  - Admin page displays "Coming soon".
  - Wallet overview returns synthetic/mock trending series.
  - NFT ownership distribution and recent sales are currently empty in UI code.
  - Holder time series in `holdersService` is synthetic fallback.
  - Dune service uses placeholder/mock behavior rather than a full query execution flow.
- Some tests are skipped/deprecated placeholders (`covalent*` test files).
- Some tracked files are empty stubs (for example: `public/sw.js`, `src/components/dashboard/TopHoldersTable.tsx`, and some test/script files).
- `README-DASHLINE.md` and docs contain notes that do not fully match current code; code should be treated as source of truth.

## Partial-Inference Marker
Any statement marked *(Partially inferred)* is derived from code behavior or naming conventions where explicit deployment/runtime intent is not fully declared in a single source file.
