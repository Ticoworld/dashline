import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/server/db";

async function main() {
  const transferCount = await prisma.transfer.count();
  const tokens = await prisma.token.findMany({
    select: { contractAddress: true, contractAddressChecksum: true, chain: true, lastBlockScanned: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const safe = JSON.parse(JSON.stringify({ transferCount, tokens }, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));
  console.log(JSON.stringify(safe, null, 2));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
