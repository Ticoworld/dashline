import "../../../../server/env";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { Contract, JsonRpcProvider } from "ethers";

const ERC20_ABI = [
  // minimal
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

function isHexAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractAddress, chain = "ethereum", creationBlock } = body || {};

    if (!contractAddress || !isHexAddress(contractAddress)) {
      return new Response(JSON.stringify({ error: "invalid contractAddress" }), { status: 400 });
    }

    // choose RPC from env (comma-separated)
    const rpcUrls = (process.env.RPC_URLS || process.env.RPC_URL || "").split(",").map(s => s.trim()).filter(Boolean);
    if (rpcUrls.length === 0) {
      return new Response(JSON.stringify({ error: "no RPC_URLS configured" }), { status: 500 });
    }

    const provider = new JsonRpcProvider(rpcUrls[0]);

    // attempt to read metadata
    let decimals: number | undefined = undefined;
    let name: string | undefined = undefined;
    let symbol: string | undefined = undefined;

    try {
      const contract = new Contract(contractAddress, ERC20_ABI, provider);
      decimals = await contract.decimals().catch(() => undefined);
      name = await contract.name().catch(() => undefined);
      symbol = await contract.symbol().catch(() => undefined);
    } catch (err) {
      // continue; we still allow registration with partial metadata
      console.warn("token metadata lookup failed", err);
    }

    // compute initial lastBlockScanned
    let lastBlockScanned = BigInt(0);
    try {
      const head = await provider.getBlockNumber();
      const offset = 50000;
      const start = creationBlock ? Number(creationBlock) : Math.max(0, head - offset);
      lastBlockScanned = BigInt(start);
    } catch (err) {
      console.warn("could not fetch head block", err);
    }

    // Use typed Prisma upsert now that client has been generated
    const contractAddr = contractAddress.toLowerCase();
    const token = await prisma.token.upsert({
      where: { contractAddress_chain: { contractAddress: contractAddr, chain } },
      create: {
        contractAddress: contractAddr,
        chain,
        name: name ?? undefined,
        symbol: symbol ?? undefined,
        decimals: typeof decimals === "number" ? decimals : undefined,
        creationBlock: creationBlock ? BigInt(String(creationBlock)) : undefined,
        lastBlockScanned: lastBlockScanned ?? BigInt(0),
        status: "pending",
      },
      update: {
        name: name ?? undefined,
        symbol: symbol ?? undefined,
        decimals: typeof decimals === "number" ? decimals : undefined,
        lastBlockScanned: lastBlockScanned ?? BigInt(0),
      },
    });

    return new Response(JSON.stringify({ id: token.id, status: token.status }), { status: 202, headers: { "content-type": "application/json" } });
  } catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("/api/tokens/register error", msg);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}

export const runtime = "nodejs";
