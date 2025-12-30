/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('../src/generated/prisma');
const { getAddress } = require('ethers');
const prisma = new PrismaClient();

async function main() {
  // Dev bypass user matches the ID we inject in tRPC when DASHLINE_DEV_BYPASS_AUTH=1
  const userId = 'dev-user';
  const email = 'dev@example.com';

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: {
      id: userId,
      clerkId: 'dev-clerk',
      email,
      name: 'Dev User',
      plan: 'FREE',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { theme: 'dark', defaultTimeRange: '7d' },
    create: { userId: user.id, theme: 'dark', defaultTimeRange: '7d' },
  });

  // Sample project to make dashboard non-empty
  const rawAddr = '0x0000000000000000000000000000000000000000';
  const checksum = (() => {
    try { return getAddress(rawAddr); } catch { return rawAddr; }
  })();
  const lower = checksum.toLowerCase();

  const project = await prisma.project.upsert({
    where: { userId_contractAddressChecksum_chain: { userId: user.id, contractAddressChecksum: checksum, chain: 'ethereum' } },
    update: { name: 'Mock Token', symbol: 'MOCK', contractAddress: lower, contractAddressChecksum: checksum },
    create: {
      userId: user.id,
      contractAddress: lower,
      contractAddressChecksum: checksum,
      chain: 'ethereum',
      name: 'Mock Token',
      symbol: 'MOCK',
      tokenStandard: 'ERC20',
      description: 'Sample project for local dev',
    },
  });

  console.log('Seed complete:', { user: user.email, project: project.name });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
