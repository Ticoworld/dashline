-- Ensure Token has checksum column and indexes (applies after Token table exists)
BEGIN;

DO $$
BEGIN
	IF to_regclass('public.Token') IS NOT NULL THEN
		ALTER TABLE "Token" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;
		CREATE UNIQUE INDEX IF NOT EXISTS "Token_contractAddressChecksum_chain_unique" ON "Token" ("contractAddressChecksum", "chain");
		CREATE INDEX IF NOT EXISTS "Token_contractAddressChecksum_idx" ON "Token" ("contractAddressChecksum");
	END IF;
END $$;

-- Project handled in previous migration; keep idempotent safety here
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;
CREATE UNIQUE INDEX IF NOT EXISTS "Project_user_contractAddressChecksum_chain_unique" ON "Project" ("userId", "contractAddressChecksum", "chain");

COMMIT;
