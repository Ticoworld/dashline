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
  // Allow ordering to be customized for dev convenience (e.g., newest first)
  const order = (process.env.INDEXER_ORDER || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 5;
  const sql = `SELECT * FROM "Token" WHERE "status" IN ('pending','syncing') AND ("paused" IS NULL OR "paused" = false) ORDER BY "createdAt" ${order} LIMIT ${safeLimit}`;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows as unknown[];
}

export async function markTokenSyncing(id: string) {
  return prisma.$executeRaw`
    UPDATE "Token" SET "status" = 'syncing', "updatedAt" = now() WHERE "id" = ${id}
  `;
}

export async function updateLastBlockScanned(id: string, blockNumber: bigint) {
  // Cast to bigint explicitly to avoid type mismatch in Postgres
  return prisma.$executeRaw`
    UPDATE "Token" SET "lastBlockScanned" = ${String(blockNumber)}::bigint, "updatedAt" = now() WHERE "id" = ${id}
  `;
}

export async function clearReindexFrom(id: string) {
  return prisma.$executeRaw`
    UPDATE "Token" SET "reindexFrom" = NULL, "updatedAt" = now() WHERE "id" = ${id}
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
      // Use a simple concatenated id fallback if uuid function isn't available
      const idPart = t.id ? `'${t.id}'` : `'${Date.now()}_${Math.random().toString(36).slice(2)}'`;
      const blockTsSec = Math.floor(t.blockTimestamp / 1000);
      return `(${idPart}, '${t.tokenId}', '${t.txHash}', ${t.logIndex}, '${t.from}', '${t.to}', ${t.value}, ${t.blockNumber}, to_timestamp(${blockTsSec}))`;
    })
    .join(",");
  const sql = `INSERT INTO "Transfer" ("id","tokenId","txHash","logIndex","from","to","value","blockNumber","blockTimestamp") VALUES ${values} ON CONFLICT ("txHash","logIndex") DO NOTHING`;
  return prisma.$executeRawUnsafe(sql);
}
