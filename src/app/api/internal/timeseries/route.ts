import "../../../../server/env";
import { prisma } from "@/server/db";
import { revalidateIfStale } from "@/server/services/cacheService";
import { getAddress } from "ethers";

type TxPoint = { date: string; count: number };
type VolPoint = { date: string; volumeRaw: string; volume?: string };

function dayRange(days: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start };
}

function toDecimalString(raw: string, decimals: number): string {
  // Convert big integer string to decimal string with `decimals` places
  const neg = raw.startsWith("-");
  const s = neg ? raw.slice(1) : raw;
  const pad = decimals - s.length + 1;
  const full = pad > 0 ? "0".repeat(pad) + s : s;
  const i = full.length - decimals;
  const intPart = i > 0 ? full.slice(0, i) : "0";
  const frac = i > 0 ? full.slice(i) : full.padStart(decimals, "0");
  const out = `${intPart}.${frac}`.replace(/\.0+$/, "").replace(/\.([0-9]*?)0+$/, ".$1");
  return neg ? `-${out}` : out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const addr = url.searchParams.get("address");
    const chain = (url.searchParams.get("chain") || process.env.DEFAULT_CHAIN || "ethereum").toLowerCase();
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 120)));

    let tokenId: string | null = null;
    let decimals = 0;

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      const checksum = project.contractAddressChecksum ?? project.contractAddress;
      const tok = await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain: project.chain } });
      if (!tok) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      tokenId = tok.id;
      decimals = tok.decimals ?? 0;
    } else if (addr) {
      let checksum = addr;
      try { checksum = getAddress(addr); } catch { /* keep raw */ }
      const tok = await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain } });
      if (!tok) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      tokenId = tok.id;
      decimals = tok.decimals ?? 0;
    } else {
      return new Response(JSON.stringify({ error: "missing parameters" }), { status: 400 });
    }

    const cacheKey = `timeseries:${tokenId}:${days}`;
    const { data } = await revalidateIfStale(cacheKey, 120, async () => {
      const { start } = dayRange(days);
      const txRows = await prisma.$queryRawUnsafe<Array<{ date: string; count: number }>>(
        `SELECT to_char(date_trunc('day', "blockTimestamp")::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM "Transfer"
         WHERE "tokenId" = '${tokenId}' AND "blockTimestamp" >= '${start.toISOString()}'
         GROUP BY 1 ORDER BY 1`
      );
      const volRows = await prisma.$queryRawUnsafe<Array<{ date: string; volume: string }>>(
        `SELECT to_char(date_trunc('day', "blockTimestamp")::date, 'YYYY-MM-DD') AS date, COALESCE(SUM("value"), 0)::text AS volume
         FROM "Transfer"
         WHERE "tokenId" = '${tokenId}' AND "blockTimestamp" >= '${start.toISOString()}'
         GROUP BY 1 ORDER BY 1`
      );
      const txSeries: TxPoint[] = txRows.map(r => ({ date: r.date, count: Number(r.count) }));
      const volumeSeries: VolPoint[] = volRows.map(r => ({ date: r.date, volumeRaw: String(r.volume), volume: decimals > 0 ? toDecimalString(String(r.volume), decimals) : undefined }));
      return { txSeries, volumeSeries, source: "internal" };
    });

    return new Response(JSON.stringify({ ...(data || { txSeries: [], volumeSeries: [] }), source: "internal" }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("/api/internal/timeseries error", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}

export const runtime = "nodejs";
