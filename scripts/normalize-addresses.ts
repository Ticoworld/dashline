import "dotenv/config";
import "../src/server/env";
import { PrismaClient } from "../src/generated/prisma";
import { getAddress } from "ethers";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

async function normalize() {
  console.log("Starting normalization of contract addresses to checksum casing...");

  // Normalize Projects using raw queries to avoid type issues until Prisma client regenerated
  const projects = (await prisma.$queryRaw`
    SELECT id, "contractAddress", chain FROM "Project"
  `) as unknown as Array<{ id: string; contractAddress: string; chain: string }>;

  for (const p of projects) {
    try {
      const checksum = getAddress(p.contractAddress);
      await prisma.$executeRawUnsafe(`UPDATE "Project" SET "contractAddressChecksum" = $1 WHERE id = $2`, checksum, p.id);
      console.log(`Updated project ${p.id} -> ${checksum}`);
    } catch (err: unknown) {
      console.warn(`Invalid project address ${p.contractAddress} for project ${p.id}: ${String(err)}`);
    }
  }

  // Normalize Tokens and dedupe
  const tokens = (await prisma.$queryRaw`SELECT * FROM "Token"`) as unknown as Array<Record<string, unknown>>;
  const groups: Record<string, Array<Record<string, unknown>>> = {};
  for (const t of tokens) {
    const key = `${String(t.contractAddress).toLowerCase()}::${t.chain}`;
    groups[key] = groups[key] || [];
    groups[key].push(t);
  }

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    let checksum: string;
    try {
      checksum = getAddress(String(group[0].contractAddress));
    } catch (err: unknown) {
      console.warn(`Invalid token address ${String(group[0].contractAddress)}: ${String(err)}`);
      continue;
    }

    // choose master row
    group.sort((a, b) => {
      if ((String(a.status) === 'complete') !== (String(b.status) === 'complete')) return String(a.status) === 'complete' ? -1 : 1;
      const da = Number(a.decimals ?? 0);
      const db = Number(b.decimals ?? 0);
      if (da !== db) return db - da;
      const at = new Date(String(a.updatedAt)).getTime();
      const bt = new Date(String(b.updatedAt)).getTime();
      return bt - at;
    });

    const master = group[0];
    try {
      await prisma.$executeRawUnsafe(`UPDATE "Token" SET "contractAddressChecksum" = $1 WHERE id = $2`, checksum, master.id);
    } catch (e) {
      console.warn(`Failed to update master token ${master.id}: ${e}`);
    }

    for (let i = 1; i < group.length; i++) {
      const t = group[i];
      try {
        await prisma.$executeRawUnsafe(`UPDATE "Transfer" SET "tokenId" = $1 WHERE "tokenId" = $2`, master.id, t.id);
        await prisma.$executeRawUnsafe(`UPDATE "TokenBalance" SET "tokenId" = $1 WHERE "tokenId" = $2`, master.id, t.id);
        await prisma.$executeRawUnsafe(`UPDATE "DailyStat" SET "tokenId" = $1 WHERE "tokenId" = $2`, master.id, t.id);
        await prisma.$executeRawUnsafe(`DELETE FROM "Token" WHERE id = $1`, t.id);
        console.log(`Merged token ${t.id} into ${master.id}`);
      } catch (e) {
        console.warn(`Failed to merge token ${t.id} into ${master.id}: ${e}`);
      }
    }
  }

  console.log("Normalization complete.");
}

if (require.main === module) {
  normalize().catch((err) => {
    console.error(err);
    process.exit(1);
  }).finally(() => process.exit(0));
}
