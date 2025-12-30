import "../../../../../server/env";
import { prisma } from "@/server/db";
import { getAddress } from "ethers";

type SeriesPoint = { t: string; transfers: number };

function startEndRange(days = 7) {
	const end = new Date();
	const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
	return { start, end };
}

export async function GET(req: Request, { params }: { params: Promise<{ addr: string }> }) {
	try {
		const url = new URL(req.url);
		const range = (url.searchParams.get("range") || "7d").toLowerCase();
		const days = range === "30d" ? 30 : 7;
		const chain = (process.env.DEFAULT_CHAIN || "ethereum").toLowerCase();
		let checksum: string;
		try {
			const { addr } = await params;
			checksum = getAddress(addr);
		} catch {
			return new Response(JSON.stringify({ error: "invalid address" }), { status: 400 });
		}

		const token = await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain } });
		if (!token) return new Response(JSON.stringify({ found: false }), { status: 404 });

		const { start, end } = startEndRange(days);
		// Aggregate transfers per UTC day
		const rows = await prisma.$queryRaw<{ day: Date; cnt: bigint }[]>`
			SELECT date_trunc('day', "blockTimestamp") AS day, count(*)::bigint AS cnt
			FROM "Transfer"
			WHERE "tokenId" = ${token.id} AND "blockTimestamp" >= ${start} AND "blockTimestamp" < ${end}
			GROUP BY 1
			ORDER BY 1 ASC
		`;
		const timeseries: SeriesPoint[] = (rows || []).map((r) => ({ t: new Date(r.day).toISOString().slice(0, 10), transfers: Number(r.cnt) }));

		// Simple totals
		const transfers = timeseries.reduce((a, b) => a + b.transfers, 0);
		// Volume (sum of value) could be large; computing it exactly isn't necessary for smoke test
		const volumeRows = await prisma.$queryRaw<{ sum: string | null }[]>`
			SELECT COALESCE(SUM("value"), 0)::text AS sum FROM "Transfer" WHERE "tokenId" = ${token.id} AND "blockTimestamp" >= ${start} AND "blockTimestamp" < ${end}
		`;
		const volume = volumeRows?.[0]?.sum ? Number(volumeRows[0].sum) : 0;

		// Holders count placeholder — rely on holders service elsewhere; keep 0 for now
		const holdersCount = 0;

		return new Response(
			JSON.stringify({ holdersCount, transfers, volume, timeseries }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	} catch (err) {
		console.error("/api/tokens/[addr]/stats error", err);
		return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
	}
}

export const runtime = "nodejs";
