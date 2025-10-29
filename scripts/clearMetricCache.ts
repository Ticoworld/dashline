#!/usr/bin/env tsx
/**
 * Clear metric snapshot cache to force fresh data fetch
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing metric snapshot cache...");
  
  const result = await prisma.metricSnapshot.deleteMany({
    where: {
      metric: {
        in: ["holdersV2:cmh3gymue000155p0y2hm3tlj:all", "topHoldersV2:cmh3gymue000155p0y2hm3tlj"]
      }
    }
  });
  
  console.log(`Deleted ${result.count} cached metrics`);
  console.log("✅ Cache cleared! Refresh your dashboard to see fresh data.");
}

main()
  .catch((e) => {
    console.error("Error clearing cache:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
