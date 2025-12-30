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
    const lastBlockScanned = token.lastBlockScanned ? Number(token.lastBlockScanned) : 0;
    let headBlock = 0;
    try {
      headBlock = provider ? await provider.getBlockNumber() : 0;
    } catch {
      // ignore provider errors; head remains 0
    }

    const creationBlock = token.creationBlock ? Number(token.creationBlock) : null;
    const total = creationBlock != null && headBlock > creationBlock ? headBlock - creationBlock : null;
    const covered = creationBlock != null ? Math.max(0, lastBlockScanned - creationBlock) : null;
    const progressPct = total && total > 0 && covered != null ? Math.min(100, Math.max(0, Math.round((covered / total) * 100))) : 0;

    const status = normalizeStatus(token.status);
    const resp = {
      status,
      lastBlockScanned,
      headBlock,
      creationBlock,
      progressPct,
    };
  return new Response(JSON.stringify(resp), { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=10, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("/api/tokens/[addr]/progress error", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}

export const runtime = "nodejs";
