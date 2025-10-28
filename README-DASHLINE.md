# Dashline

Dashline is a Next.js + tRPC + Prisma dashboard for blockchain project metrics (holders, volume, price, transactions).

Quick start

1. Install deps

```powershell
npm install
```

2. Environment

Copy `.env.example` -> `.env` and fill database and API keys (optional: DUNE_API_KEY, BITQUERY_API_KEY, MORALIS_API_KEY, ETHERSCAN_API_KEY, COINGECKO_KEY, CLERK_*).

3. Generate Prisma client (after changing prisma/schema.prisma)

```powershell
npx prisma generate
```

4. Run dev server

```powershell
npm run dev
```

5. Build

```powershell
npm run build
```

Notes

- The project uses an in-memory cache (MVP). For production, replace `src/server/services/cacheService.ts` with Redis.
- External services (Bitquery/The Graph/Dexscreener/CoinGecko, optional Dune) have graceful fallbacks and light mock data when API keys are missing — this lets you develop the UI without keys.
- Server-side Clerk auth currently needs a small fix to re-enable SSR auth in `src/app/dashboard/layout.tsx`. I left a TODO there.

Next steps you might want me to run now:

- Reintroduce server-side Clerk auth with correct Request-like object.
- Wire `timeRange` into backend metrics where needed (done for getOverview; we can propagate more).
- Clean the remaining minor lint warnings and finish strict typing across UI.

If you want me to continue, tell me which next item to prioritize or say `do all` and I'll continue through the list.
