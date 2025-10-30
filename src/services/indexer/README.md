Indexer worker

This is a small indexer that scans ERC20 Transfer logs for tokens registered in the DB.

Environment
- DATABASE_URL (required)
- RPC_URLS (comma-separated public RPCs; optional, defaults to https://rpc.ankr.com/eth)
- BATCH_BLOCKS (default 5000)
- POLL_INTERVAL_MS (default 15000)

Dev run
1. Ensure Postgres is running and migrations applied (see prisma/migrations).
2. Install dev dependency ts-node if you want to run TS directly:

   npm i -D ts-node

3. Run the indexer locally:

   node -r ts-node/register src/services/indexer/indexer.ts

Notes
- The indexer polls the DB for tokens with status `pending` or `syncing` and scans blocks in batches.
- It inserts Transfer rows and updates `Token.lastBlockScanned` and `Token.status`.
- This is an initial skeleton focused on incremental, testable additions. Improvements: RPC rotation/backoff, parallel token processing, balance delta computation, and daily stats aggregation.
