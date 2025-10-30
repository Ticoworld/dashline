import { prisma } from "@/server/db";
import { getProvider } from "@/services/indexer/rpcManager";
import { getAddress } from "ethers";

type UpsertInput = {
  contractAddress: string;
  chain: string;
  creationBlock?: number | string;
};

export async function upsertTokenForIndexing(input: UpsertInput) {
  const { contractAddress, chain, creationBlock } = input;

  // Normalize to checksum and keep a lowercase copy
  const checksum = getAddress(contractAddress.trim());
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

  // Find by checksum+chain
  const existing = await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain } });
  if (existing) {
    if (existing.status === "complete") return existing;

    const updated = await prisma.token.update({
      where: { id: existing.id },
      data: {
        contractAddress: lower,
        contractAddressChecksum: checksum,
        status: "pending",
        lastBlockScanned:
          existing.lastBlockScanned && Number(existing.lastBlockScanned) > 0
            ? existing.lastBlockScanned
            : lastBlockScanned,
      },
    });
    return updated;
  }

  // Create new token
  const created = await prisma.token.create({
    data: {
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

  return created;
}

 
