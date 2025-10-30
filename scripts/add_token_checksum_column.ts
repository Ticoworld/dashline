import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  console.log('Adding token checksum column/indexes if missing...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Token" ADD COLUMN IF NOT EXISTS "contractAddressChecksum" text;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Token_contractAddressChecksum_chain_unique" ON "Token" ("contractAddressChecksum", "chain");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Token_contractAddressChecksum_idx" ON "Token" ("contractAddressChecksum");`);
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});