import "../../../../../../server/env";
import { prisma } from "@/server/db";
import { checkAdmin, resolveToken } from "../_utils";

export async function POST(req: Request, { params }: { params: Promise<{ addr: string }> }) {
  if (!checkAdmin(req)) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  const { addr } = await params;
  const body = await req.json().catch(() => ({}));
  const chain = String(body?.chain || process.env.DEFAULT_CHAIN || "ethereum").toLowerCase();
  const token = await resolveToken(addr, chain);
  if (!token) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  await prisma.token.update({ where: { id: token.id }, data: { lastBlockScanned: BigInt(0), status: "pending", reindexFrom: null, paused: false } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
}

export const runtime = "nodejs";
