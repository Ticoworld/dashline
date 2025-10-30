import "../../../../server/env";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const contractAddress = url.searchParams.get("contractAddress")?.toLowerCase();
    const chain = url.searchParams.get("chain") || "ethereum";
    if (!contractAddress) {
      return new Response(JSON.stringify({ error: "missing contractAddress" }), { status: 400 });
    }

    const token = await prisma.token.findUnique({ where: { contractAddress_chain: { contractAddress, chain } } });
    if (!token) return new Response(JSON.stringify({ found: false }), { status: 404 });

    return new Response(JSON.stringify({ found: true, status: token.status, lastBlockScanned: token.lastBlockScanned ?? 0 }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("/api/tokens/status error", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}

export const runtime = "nodejs";
