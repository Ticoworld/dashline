-- Migration: add token indexing tables
-- Generated manually to add Token, Transfer, TokenBalance, DailyStat

BEGIN;

CREATE TABLE IF NOT EXISTS "Token" (
  "id" text PRIMARY KEY,
  "contractAddress" text NOT NULL,
  "chain" text NOT NULL,
  "name" text,
  "symbol" text,
  "decimals" integer,
  "creationBlock" bigint,
  "lastBlockScanned" bigint DEFAULT 0,
  "status" text DEFAULT 'pending',
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Token_contractAddress_chain_unique" ON "Token" ("contractAddress", "chain");
CREATE INDEX IF NOT EXISTS "Token_status_idx" ON "Token" ("status");
CREATE INDEX IF NOT EXISTS "Token_contractAddress_idx" ON "Token" ("contractAddress");

CREATE TABLE IF NOT EXISTS "Transfer" (
  "id" text PRIMARY KEY,
  "tokenId" text NOT NULL,
  "txHash" text NOT NULL,
  "logIndex" integer NOT NULL,
  "from" text NOT NULL,
  "to" text NOT NULL,
  "value" bigint NOT NULL,
  "blockNumber" bigint NOT NULL,
  "blockTimestamp" timestamp with time zone NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT transfer_token_fk FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Transfer_txHash_logIndex_unique" ON "Transfer" ("txHash", "logIndex");
CREATE INDEX IF NOT EXISTS "Transfer_tokenId_idx" ON "Transfer" ("tokenId");
CREATE INDEX IF NOT EXISTS "Transfer_blockNumber_idx" ON "Transfer" ("blockNumber");

CREATE TABLE IF NOT EXISTS "TokenBalance" (
  "id" text PRIMARY KEY,
  "tokenId" text NOT NULL,
  "address" text NOT NULL,
  "balance" bigint DEFAULT 0,
  "updatedAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT tokenbalance_token_fk FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TokenBalance_tokenId_address_unique" ON "TokenBalance" ("tokenId", "address");
CREATE INDEX IF NOT EXISTS "TokenBalance_tokenId_idx" ON "TokenBalance" ("tokenId");

CREATE TABLE IF NOT EXISTS "DailyStat" (
  "id" text PRIMARY KEY,
  "tokenId" text NOT NULL,
  "day" timestamp with time zone NOT NULL,
  "txCount" integer DEFAULT 0,
  "holders" integer DEFAULT 0,
  "volume" numeric DEFAULT 0,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT dailystat_token_fk FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyStat_tokenId_day_unique" ON "DailyStat" ("tokenId", "day");
CREATE INDEX IF NOT EXISTS "DailyStat_tokenId_day_idx" ON "DailyStat" ("tokenId", "day");

COMMIT;
