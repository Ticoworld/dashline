import { Interface } from "ethers";
import { id } from "ethers";
import { rotateProvider } from "./rpcManager";
import { TransferRow } from "./dbClient";

const ERC20_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
const iface = new Interface(ERC20_ABI);
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");

export async function scanRange(
  provider: unknown,
  tokenId: string,
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<TransferRow[]> {
  if (fromBlock > toBlock) return [];
  type ProviderLike = { getLogs: (...args: unknown[]) => Promise<unknown[]>; getBlock: (n: number) => Promise<{ timestamp: number }> };
  // Allow swapping provider on rate-limit
  let p = provider as unknown as ProviderLike;
  async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchLogsRange(f: number, t: number, attempt = 0): Promise<unknown[]> {
    const filter = { address: contractAddress, topics: [TRANSFER_TOPIC], fromBlock: f, toBlock: t };
    try {
      return await p.getLogs(filter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? String(err.message || err) : String(err);
      const code = (typeof err === "object" && err && (err as { code?: unknown })?.code) as number | undefined;
      const tooMany = msg.includes("10000 results") || msg.includes("query returned more than 10000 results");
      const rateLimited = msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("rate");
      const internalErr = code === -32603 || msg.toLowerCase().includes("internal error");
      const missingResponse = msg.toLowerCase().includes("missing response for request");

      if (rateLimited || internalErr || missingResponse || code === -32005) {
        // exponential backoff up to ~3s
        const backoff = Math.min(3000, 250 * Math.pow(2, Math.min(4, attempt))) + Math.floor(Math.random() * 150);
        await sleep(backoff);
        // rotate provider to spread load across RPCs
        p = rotateProvider() as unknown as ProviderLike;
        // After a few attempts with internal errors, try splitting the range to help flaky providers
        if ((internalErr || missingResponse) && attempt >= 2 && f < t) {
          const mid = Math.floor((f + t) / 2);
          const left = await fetchLogsRange(f, mid, attempt + 1);
          const right = await fetchLogsRange(mid + 1, t, attempt + 1);
          return [...left, ...right];
        }
        return fetchLogsRange(f, t, attempt + 1);
      }
      if (tooMany && f < t) {
        const mid = Math.floor((f + t) / 2);
        const left = await fetchLogsRange(f, mid, attempt);
        const right = await fetchLogsRange(mid + 1, t, attempt);
        return [...left, ...right];
      }
      // Smallest span still fails; surface error
      throw err as Error;
    }
  }

  const logs = await fetchLogsRange(fromBlock, toBlock);
  const transfers: TransferRow[] = [];
  type EthersRawLog = { topics: string[]; data: string; blockNumber?: number; transactionHash?: string; logIndex?: number };
  const blockCache = new Map<number, { timestamp: number }>();

  // Helper: resilient getBlock with backoff + provider rotation
  async function getBlockWithRetry(blockNumber: number, attempt = 0): Promise<{ timestamp: number }> {
    const cached = blockCache.get(blockNumber);
    if (cached) return cached;
    try {
      const b = await p.getBlock(blockNumber);
      blockCache.set(blockNumber, b);
      return b;
    } catch (err: unknown) {
      const msg = err instanceof Error ? String(err.message || err) : String(err);
      const rateLimited = msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("rate")
        || (typeof err === "object" && err && (err as { code?: unknown })?.code === -32005)
        || msg.toLowerCase().includes("missing response for request");
      const delay = Math.min(5000, 300 * Math.pow(2, Math.min(5, attempt))) + Math.floor(Math.random() * 200);
      if (rateLimited && attempt < 6) {
        await sleep(delay);
        // rotate RPC to avoid hammering same endpoint
        p = rotateProvider() as unknown as ProviderLike;
        return getBlockWithRetry(blockNumber, attempt + 1);
      }
      // If not rate-limited or exceeded retries, rethrow
      throw err as Error;
    }
  }

  // Prefetch unique block timestamps sequentially to minimize RPC pressure
  const uniqueBlocks = Array.from(
    new Set((logs as Array<{ blockNumber?: number }>).map((l) => l.blockNumber ?? 0).filter((n) => Number.isFinite(n) && n > 0))
  ).sort((a, b) => a - b);

  for (const bn of uniqueBlocks) {
    try {
      await getBlockWithRetry(bn);
    } catch (err) {
      // If a block fetch ultimately fails, we skip logs for that block after logging once
      console.warn(`getBlock failed after retries for block ${bn}`, err);
    }
  }

  // Now build transfer rows using cached timestamps
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log as unknown as EthersRawLog);
      if (!parsed) continue;
      const from = parsed.args[0];
      const to = parsed.args[1];
      const value = parsed.args[2].toString();
      const rawLog = log as unknown as { transactionHash?: string; logIndex?: number; blockNumber?: number };
      const txHash = rawLog.transactionHash ?? "";
      const logIndex = rawLog.logIndex ?? 0;
      const blockNumber = rawLog.blockNumber ?? 0;
      const block = blockCache.get(blockNumber) ?? await getBlockWithRetry(blockNumber);
      const blockTimestamp = block.timestamp * 1000;

      transfers.push({
        tokenId,
        txHash,
        logIndex: Number(logIndex),
        from: String(from).toLowerCase(),
        to: String(to).toLowerCase(),
        value,
        blockNumber,
        blockTimestamp: Number(blockTimestamp),
      });
    } catch (err) {
      // Only log parse errors; block fetching is handled via getBlockWithRetry
      console.warn("skipping log due to parse/build error", err);
    }
  }
  return transfers;
}
