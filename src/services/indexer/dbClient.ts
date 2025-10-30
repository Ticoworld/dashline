import { prisma } from "@/server/db";

export type TransferRow = {
  id?: string;
  tokenId: string;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  value: string | number | bigint;
  blockNumber: string | number | bigint;
  blockTimestamp: number; // ms
};

export async function getPendingTokens(limit = 5) {
  // tokens with status pending or syncing
  const rows = await prisma.$queryRaw`
    SELECT * FROM "Token" WHERE "status" IN ('pending','syncing') ORDER BY "createdAt" ASC LIMIT ${limit}
  `;
  return rows as unknown[];
}

export async function markTokenSyncing(id: string) {
  return prisma.$executeRaw`
    UPDATE "Token" SET "status" = 'syncing', "updatedAt" = now() WHERE "id" = ${id}
  `;
}

export async function updateLastBlockScanned(id: string, blockNumber: bigint) {
  return prisma.$executeRaw`
    UPDATE "Token" SET "lastBlockScanned" = ${String(blockNumber)}, "updatedAt" = now() WHERE "id" = ${id}
  `;
}

export async function markTokenComplete(id: string) {
  return prisma.$executeRaw`
    UPDATE "Token" SET "status" = 'complete', "updatedAt" = now() WHERE "id" = ${id}
  `;
}

export async function insertTransfers(transfers: Array<TransferRow>) {
  if (!transfers || transfers.length === 0) return;
  // bulk insert using VALUES - avoid SQL injection by building from typed data
  const values = transfers
    .map(t => {
      const idPart = t.id ? `'${t.id}'` : 'gen_random_uuid()::text';
      const blockTsSec = Math.floor(t.blockTimestamp / 1000);
      return `(${idPart}, '${t.tokenId}', '${t.txHash}', ${t.logIndex}, '${t.from}', '${t.to}', ${t.value}, ${t.blockNumber}, to_timestamp(${blockTsSec}))`;
    })
    .join(",");
  const sql = `INSERT INTO "Transfer" ("id","tokenId","txHash","logIndex","from","to","value","blockNumber","blockTimestamp") VALUES ${values} ON CONFLICT ("txHash","logIndex") DO NOTHING`;
  return prisma.$executeRawUnsafe(sql);
}
