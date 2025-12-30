import "../../../../server/env";
import { prisma } from "@/server/db";
import { JsonRpcProvider, getAddress } from "ethers";

type Status = "pending" | "syncing" | "complete" | "failed";
type TokenRow = { status: string | null; lastBlockScanned: bigint | number | null; updatedAt: Date; creationBlock?: bigint | number | null; chain?: string | null };

function getRpc(): JsonRpcProvider | null {
  const rpcUrls = (process.env.RPC_URLS || process.env.RPC_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!rpcUrls.length) return null;
  return new JsonRpcProvider(rpcUrls[0]);
}

function fastPassOffsetBlocks(chain: string, days = Number(process.env.FAST_PASS_DAYS || 7)) {
  const map: Record<string, number> = { ethereum: 7200, base: 7200, polygon: 43000 };
  const perDay = map[chain.toLowerCase()] ?? 7200;
  return Math.max(1000, perDay * days);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const contractAddressChecksum = url.searchParams.get("contractAddressChecksum");
    const contractAddress = url.searchParams.get("contractAddress");
    const chain = url.searchParams.get("chain") || undefined;

  let token: TokenRow | null = null;

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return new Response(JSON.stringify({ found: false }), { status: 404 });
      const checksum = project.contractAddressChecksum || (project.contractAddress ? safeChecksum(project.contractAddress) : undefined);
      if (!checksum || !project.chain) return new Response(JSON.stringify({ found: false }), { status: 404 });
      token = (await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain: project.chain } })) as unknown as TokenRow | null;
    } else if (contractAddressChecksum && chain) {
      token = (await prisma.token.findFirst({ where: { contractAddressChecksum, chain } })) as unknown as TokenRow | null;
    } else if (contractAddress && chain) {
      const checksum = safeChecksum(contractAddress);
      token = (await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain } })) as unknown as TokenRow | null;
    } else {
      return new Response(JSON.stringify({ error: "missing parameters" }), { status: 400 });
    }

    if (!token) {
      return new Response(JSON.stringify({ found: false }), { status: 404 });
    }

    const status = normalizeStatus(token.status) as Status;
    const lastBlockScanned = token.lastBlockScanned != null ? Number(token.lastBlockScanned) : undefined;
    const lastUpdated = token.updatedAt ? token.updatedAt.toISOString() : undefined;
    // Optional progress info
    let recentReady = false;
    let progressPct = 0;
    try {
      const provider = getRpc();
      if (provider && typeof lastBlockScanned === "number") {
        const head = await provider.getBlockNumber();
        const chainName = (token.chain || process.env.DEFAULT_CHAIN || "ethereum").toString();
        const threshold = Math.max(0, head - fastPassOffsetBlocks(chainName));
        recentReady = lastBlockScanned >= threshold;
        if (token.creationBlock != null) {
          const creation = Number(token.creationBlock);
          const total = Math.max(1, head - creation);
          progressPct = Math.min(100, Math.max(0, Math.round(((lastBlockScanned - creation) / total) * 100)));
        }
      }
    } catch {
      // ignore provider errors; progress fields remain defaults
    }
    return new Response(
      JSON.stringify({ found: true, status, lastBlockScanned, lastUpdated, recentReady, progressPct }),
      { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=10, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("/api/tokens/status error", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}

function safeChecksum(addr: string): string {
  try {
    return getAddress(addr.trim());
  } catch {
    return addr.trim();
  }
}

function normalizeStatus(s?: string | null): Status {
  if (s === "pending" || s === "syncing" || s === "complete") return s;
  return "failed";
}

export const runtime = "nodejs";
