import "../../../../../server/env";
import { prisma } from "@/server/db";
import { JsonRpcProvider, getAddress } from "ethers";

type Status = "pending" | "syncing" | "complete" | "failed";

function normalizeStatus(s?: string | null): Status {
	if (s === "pending" || s === "syncing" || s === "complete") return s;
	return "failed";
}

function getRpc(): JsonRpcProvider | null {
	const rpcUrls = (process.env.RPC_URLS || process.env.RPC_URL || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (!rpcUrls.length) return null;
	return new JsonRpcProvider(rpcUrls[0]);
}

function fastPassOffsetBlocks(chain: string, days = Number(process.env.FAST_PASS_DAYS || 7)) {
	// Approx blocks/day by chain; Ethereum ~7200, Polygon ~43k, Base ~7200 (12s blocks)
	const map: Record<string, number> = { ethereum: 7200, base: 7200, polygon: 43000 };
	const perDay = map[chain.toLowerCase()] ?? 7200;
	return Math.max(1000, perDay * days);
}

export async function GET(_req: Request, { params }: { params: Promise<{ addr: string }> }) {
	try {
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

		const provider = getRpc();
		let recentReady = false;
		let backfillPct = 0;
		if (provider && token.lastBlockScanned != null) {
			const head = await provider.getBlockNumber();
			const threshold = Math.max(0, head - fastPassOffsetBlocks(chain));
			recentReady = Number(token.lastBlockScanned) >= threshold;
			// naive backfill percent: scanned distance over total since creationBlock (if known)
			if (token.creationBlock) {
				const total = Math.max(1, head - Number(token.creationBlock));
				backfillPct = Math.min(100, Math.max(0, Math.round(((Number(token.lastBlockScanned) - Number(token.creationBlock)) / total) * 100)));
			}
		}

		const status = normalizeStatus(token.status);
		return new Response(
			JSON.stringify({ status, recentReady, backfillPct }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	} catch (err) {
		console.error("/api/tokens/[addr]/status error", err);
		return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
	}
}

export const runtime = "nodejs";
