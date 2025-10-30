import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

type TokenRow = {
  id: string;
  status: string;
  decimals: number | null;
  creationBlock: bigint | null;
  lastBlockScanned: bigint | null;
  name: string | null;
  symbol: string | null;
  updatedAt: Date | string;
};

function pickCanonical(group: TokenRow[]) {
  // Prefer status 'complete', then having decimals, then most recent updatedAt
  return group.sort((a, b) => {
    if ((a.status === 'complete') !== (b.status === 'complete')) return a.status === 'complete' ? -1 : 1;
    const da = a.decimals ?? 0;
    const db = b.decimals ?? 0;
    if (da !== db) return db - da;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

async function findDuplicateGroups() {
  // Duplicates where checksum present
  const byChecksum = await prisma.$queryRaw<{ contractAddressChecksum: string; chain: string; cnt: number }[]>`
    SELECT "contractAddressChecksum", chain, COUNT(*) as cnt
    FROM "Token"
    WHERE "contractAddressChecksum" IS NOT NULL
    GROUP BY "contractAddressChecksum", chain
    HAVING COUNT(*) > 1
  `;

  // Potential duplicates where checksum is NULL (should be none after normalization): group by lower contractAddress
  const byLower = await prisma.$queryRaw<{ contractAddress: string; chain: string; cnt: number }[]>`
    SELECT LOWER("contractAddress") as contractAddress, chain, COUNT(*) as cnt
    FROM "Token"
    WHERE "contractAddressChecksum" IS NULL
    GROUP BY LOWER("contractAddress"), chain
    HAVING COUNT(*) > 1
  `;

  return { byChecksum, byLower };
}

async function mergeGroupByChecksum(contractAddressChecksum: string, chain: string) {
  const rows = await prisma.token.findMany({ where: { contractAddressChecksum, chain } });
  if (rows.length < 2) return { merged: 0 };

  const canonical = pickCanonical(rows);
  const duplicates = rows.filter(r => r.id !== canonical.id);

  // Merge missing fields into canonical
  const data: Partial<TokenRow> = {};
  for (const d of duplicates) {
    if (canonical.decimals == null && d.decimals != null) data.decimals = d.decimals;
    if (canonical.creationBlock == null && d.creationBlock != null) data.creationBlock = d.creationBlock;
    if (canonical.lastBlockScanned == null && d.lastBlockScanned != null) data.lastBlockScanned = d.lastBlockScanned;
    if (canonical.name == null && d.name != null) data.name = d.name;
    if (canonical.symbol == null && d.symbol != null) data.symbol = d.symbol;
  }
  if (Object.keys(data).length) await prisma.token.update({ where: { id: canonical.id }, data });

  // Reassign dependents
  if (duplicates.length) {
    await prisma.transfer.updateMany({ where: { tokenId: { in: duplicates.map(d => d.id) } }, data: { tokenId: canonical.id } });
    await prisma.tokenBalance.updateMany({ where: { tokenId: { in: duplicates.map(d => d.id) } }, data: { tokenId: canonical.id } });
    await prisma.dailyStat.updateMany({ where: { tokenId: { in: duplicates.map(d => d.id) } }, data: { tokenId: canonical.id } });
  }

  // Delete duplicates
  await prisma.token.deleteMany({ where: { id: { in: duplicates.map(d => d.id) } } });
  return { merged: duplicates.length, canonicalId: canonical.id };
}

async function main() {
  console.log('Scanning for duplicate tokens...');
  const { byChecksum, byLower } = await findDuplicateGroups();
  if (byChecksum.length === 0 && byLower.length === 0) {
    console.log('No duplicates found.');
    return;
  }
  if (byLower.length > 0) {
    console.warn('Warning: Found tokens with NULL checksum that have duplicates by lowercased address. Consider re-running normalization.');
    console.table(byLower);
  }
  for (const g of byChecksum) {
    console.log(`Merging duplicates for ${g.contractAddressChecksum} on ${g.chain} (count=${g.cnt})`);
    const res = await mergeGroupByChecksum(g.contractAddressChecksum, g.chain);
    console.log('Merged:', res);
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
