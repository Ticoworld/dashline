import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic"; // ensure it runs on the server

export async function GET() {
  const start = Date.now();
  let db = false;
  let redis: boolean | null = null;
  let redisWriteRead: boolean | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  // Optional Redis check if configured
  const REDIS_URL = process.env.REDIS_URL;
  if (REDIS_URL) {
    try {
      // dynamic import to keep optional dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("ioredis");
      const IORedis = mod?.default ?? mod;
      const client = new IORedis(REDIS_URL, { lazyConnect: true, connectTimeout: 2000 });
      await client.connect();
      await client.ping();
      // Write/read/delete probe
      const key = `health:probe:${Date.now()}`;
      await client.set(key, "1", "EX", 10);
      const got = await client.get(key);
      await client.del(key);
      redisWriteRead = got === "1";
      await client.quit();
      redis = true;
    } catch {
      redis = false;
      redisWriteRead = false;
    }
  }
  const ms = Date.now() - start;
  return NextResponse.json({ ok: true, db, redis, redisWriteRead, ms });
}
