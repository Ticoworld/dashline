-- Add contractAddressChecksum columns and unique indexes (guard against missing Token table)
BEGIN;

-- Project column always safe
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;

-- Token table might not exist yet in this migration order; guard via to_regclass
DO $$
BEGIN
  IF to_regclass('public.Token') IS NOT NULL THEN
    ALTER TABLE "Token" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS "Token_contractAddressChecksum_chain_unique" ON "Token" ("contractAddressChecksum", "chain");
    EXCEPTION WHEN undefined_table THEN
      -- If Token doesn't exist yet, ignore; later migration will add
      NULL;
    END;
  END IF;
END $$;

-- create unique index for projects per user on checksum+chain
CREATE UNIQUE INDEX IF NOT EXISTS "Project_user_contractAddressChecksum_chain_unique" ON "Project" ("userId", "contractAddressChecksum", "chain");

COMMIT;
