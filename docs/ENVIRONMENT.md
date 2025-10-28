# Environment configuration

This app uses Next.js (App Router), tRPC, Clerk, Prisma (Postgres), and optional Redis. Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

Keep secrets out of client code and `.env.example`. For local development, copy `.env.example` to `.env.local` and fill the values.

## Variables

- DATABASE_URL
  - Scope: server only
  - Purpose: Prisma/Postgres connection string
  - Example: `postgresql://user:password@localhost:5432/dashline`
  - Failure modes: build/runtime DB init fails; migrations fail

- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  - Scope: client + server; safe to expose
  - Purpose: Clerk frontend SDK
  - Failure modes: UI auth components break; `ClerkProvider` is disabled in `app/layout.tsx`

- CLERK_SECRET_KEY
  - Scope: server only (do not expose)
  - Purpose: Clerk server auth
  - Failure modes: `auth()` returns null; all protected procedures redirect/UNAUTHORIZED

- DUNE_API_KEY
  - Scope: server only
  - Purpose: Optional presets/mocks for charts when other providers missing
  - Failure modes: if missing, some fallback series may be synthetic instead of preset-based

- BITQUERY_API_KEY
  - Scope: server only
  - Purpose: Primary source for holders and transaction series
  - Failure modes: holders/txs fall back to Moralis or synthetic

- MORALIS_API_KEY
  - Scope: server only
  - Purpose: Fallback holders API when Bitquery is unavailable
  - Failure modes: holders fall back to synthetic

- ETHERSCAN_API_KEY (optional)
  - Scope: server only
  - Purpose: Minimal fallback for transfer counts (daily tx series)
  - Failure modes: tx series may rely on synthetic if missing

- REDIS_URL (optional)
  - Scope: server only
  - Purpose: Enable Redis cache instead of in-memory cache
  - Failure modes: without it, cache is per-instance only; with a bad URL, cache init logs error and falls back to memory

- NEXT_PUBLIC_APP_URL
  - Scope: client + server
  - Purpose: Public origin for links/callbacks
  - Failure modes: incorrect URLs in UI/client requests

- NODE_ENV
  - Scope: node
  - Purpose: Controls logging and production behavior
  - Values: `development` | `production` | `test`

- PORT (optional)
  - Scope: node
  - Purpose: Local dev port if 3000 is unavailable

- DASHLINE_DEV_BYPASS_AUTH (dev only)
  - Scope: server only
  - Purpose: If set to `"1"`, `/dashboard` bypasses auth in dev
  - Failure modes: security risk if enabled in production (don’t set in prod)

- VERCEL_URL (platform-provided)
  - Scope: server
  - Purpose: tRPC base URL resolution when deployed on Vercel
  - Note: Provided by Vercel at runtime; don’t set locally

## Client vs server exposure

- Client-visible: Only variables starting with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`).
- Keep secrets server-only: database URL, Clerk secret, Bitquery/Moralis/Etherscan/Dune keys, Redis URL.

## Production checklist

- Ensure `DATABASE_URL` points to your production DB.
- Populate `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from Clerk dashboard.
- Provide `BITQUERY_API_KEY` (strongly recommended) and `MORALIS_API_KEY` for accurate holders; `DUNE_API_KEY` optional for presets.
- Set `REDIS_URL` to a managed Redis for multi-instance caching.
- Do NOT set `DASHLINE_DEV_BYPASS_AUTH` in production.
- On Vercel, `VERCEL_URL` is set automatically.
