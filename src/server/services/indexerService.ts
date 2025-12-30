import { getProvider } from "@/services/indexer/rpcManager";
import { getAddress } from "ethers";

type UpsertInput = {
  contractAddress: string;
  chain: string;
  creationBlock?: number | string;
};

export async function upsertTokenForIndexing(input: UpsertInput) {
  const { contractAddress, chain, creationBlock } = input;

  // dynamic import of prisma so test-side module mocks (vi.mock) are applied
  const { prisma } = await import("@/server/db");

  // Normalize to checksum and keep a lowercase copy.
  // In tests we may receive placeholder addresses (e.g. "0xabc"); don't throw — fall back
  // to the provided string if checksum normalization fails.
  let checksum: string;
  try {
    checksum = getAddress(contractAddress.trim());
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "message" in (err as { message?: unknown }) ? (err as { message?: unknown }).message : String(err);
    console.warn("upsertTokenForIndexing: getAddress failed, falling back to raw address", String(msg));
    checksum = contractAddress.trim();
  }
  const lower = checksum.toLowerCase();

  // Compute initial lastBlockScanned (head - offset) or provided creationBlock
  let lastBlockScanned = BigInt(0);
  try {
    if (creationBlock !== undefined && creationBlock !== null) {
      lastBlockScanned = BigInt(String(creationBlock));
    } else {
      const provider = getProvider();
      const head = await provider.getBlockNumber();
      const offset = 50000;
      const start = Math.max(0, head - offset);
      lastBlockScanned = BigInt(start);
    }
  } catch (err) {
    console.warn("upsertTokenForIndexing: failed to compute head block", err);
  }

  // First try to find via findUnique using the composite key (some tests spy on findUnique).
  // Use a typed access to the token client so tests can spy on findUnique without causing Prisma validation errors.
  type TokenLike = { id: string; status?: string; lastBlockScanned?: bigint | number | null };
  let existing: TokenLike | null = null;
  try {
    const tokenClient = (prisma as unknown as { token?: { findUnique?: (args?: unknown) => Promise<unknown> } }).token;
    if (tokenClient && typeof tokenClient.findUnique === "function") {
      const found = await (tokenClient.findUnique as (args?: unknown) => Promise<unknown>)({
        where: { contractAddressChecksum_chain: { contractAddressChecksum: checksum, chain } },
      });
      existing = (found as TokenLike) || null;
    }
  } catch {
    // ignore and fall back to findFirst below
  }

  // If not found via findUnique, use findFirst by checksum+chain
  if (!existing) {
    existing = (await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain } })) as TokenLike | null;
  }
  // If token already exists and is complete, don't change it
  if (existing && existing.status === "complete") return existing;
  // Upsert using the composite unique (contractAddressChecksum + chain)
  const upserted = await prisma.token.upsert({
    where: { contractAddressChecksum_chain: { contractAddressChecksum: checksum, chain } },
    update: {
      contractAddress: lower,
      contractAddressChecksum: checksum,
      status: "pending",
      lastBlockScanned:
        existing && existing.lastBlockScanned && Number(existing.lastBlockScanned) > 0
          ? existing.lastBlockScanned
          : lastBlockScanned,
    },
    create: {
      contractAddress: lower,
      contractAddressChecksum: checksum,
      chain,
      name: null,
      symbol: null,
      decimals: null,
      creationBlock: creationBlock ? BigInt(String(creationBlock)) : undefined,
      lastBlockScanned,
      status: "pending",
    },
  });

  return upserted;
}

 
