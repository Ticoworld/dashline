import "../../../../../../server/env";
import { prisma } from "@/server/db";
import { checkAdmin, resolveToken } from "../_utils";

export async function POST(req: Request, { params }: { params: Promise<{ addr: string }> }) {
  if (!checkAdmin(req)) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  const { addr } = await params;
  // Parse body defensively and type it to avoid `any` for lint/ts rules
  type ReindexBody = { chain?: string; fromBlock?: string | number };
  let body: ReindexBody = {};
  try {
    // req.json() can throw on invalid JSON or non-JSON bodies
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as ReindexBody;
  } catch {
    body = {};
  }
  const chain = String(body?.chain || process.env.DEFAULT_CHAIN || "ethereum").toLowerCase();
  const fromBlock = Number(body?.fromBlock);
  if (!Number.isFinite(fromBlock) || fromBlock <= 0) {
    return new Response(JSON.stringify({ error: "invalid fromBlock" }), { status: 400 });
  }
  const token = await resolveToken(addr, chain);
  if (!token) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  await prisma.token.update({ where: { id: token.id }, data: { reindexFrom: BigInt(fromBlock), status: "syncing" } });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
}

export const runtime = "nodejs";
