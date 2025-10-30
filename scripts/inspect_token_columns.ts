import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Token'`;
  console.log('Token table columns:');
  console.table(cols as any);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
