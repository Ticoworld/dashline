-- Fix missing Token.contractAddressChecksum in dev DBs where earlier idempotent migrations ran before Token existed
BEGIN;

ALTER TABLE "Token" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;
CREATE UNIQUE INDEX IF NOT EXISTS "Token_contractAddressChecksum_chain_unique" ON "Token" ("contractAddressChecksum", "chain");
CREATE INDEX IF NOT EXISTS "Token_contractAddressChecksum_idx" ON "Token" ("contractAddressChecksum");

COMMIT;
