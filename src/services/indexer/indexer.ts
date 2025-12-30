import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import "../../server/env";
import { getPendingTokens, markTokenSyncing, updateLastBlockScanned, markTokenComplete, insertTransfers, clearReindexFrom } from "./dbClient";
import { getProvider } from "./rpcManager";
import { scanRange } from "./scanner";
import PQueue from "p-queue";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 15_000);
const BATCH_BLOCKS = Number(process.env.BATCH_BLOCKS || 300);
const INDEXER_CONCURRENCY = Number(process.env.INDEXER_CONCURRENCY || 1);

// Cache head block to reduce RPC calls (refresh every 30s)
let cachedHeadBlock: { block: number; timestamp: number } | null = null;
const HEAD_CACHE_MS = 30_000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getHeadBlockCached(provider: { getBlockNumber: () => Promise<number> }): Promise<number> {
  const now = Date.now();
  if (cachedHeadBlock && (now - cachedHeadBlock.timestamp) < HEAD_CACHE_MS) {
    return cachedHeadBlock.block;
  }
  
  // Retry logic for getBlockNumber with exponential backoff
  let attempt = 0;
  while (attempt < 5) {
    try {
      const head = await provider.getBlockNumber();
      cachedHeadBlock = { block: head, timestamp: now };
      return head;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("Cannot fulfill") || msg.includes("429") || msg.includes("rate");
      if (isRateLimit && attempt < 4) {
        const backoff = Math.min(5000, 500 * Math.pow(2, attempt));
        console.warn(`getBlockNumber rate limited, retrying in ${backoff}ms (attempt ${attempt + 1}/5)`);
        await sleep(backoff);
        attempt++;
        continue;
      }
      // If cached value exists, use it as fallback
      if (cachedHeadBlock) {
        console.warn("getBlockNumber failed, using cached head block", cachedHeadBlock.block);
        return cachedHeadBlock.block;
      }
      throw err;
    }
  }
  throw new Error("getBlockNumber exhausted retries");
}

async function processToken(token: { id: string; contractAddress: string; lastBlockScanned?: number | string; reindexFrom?: number | string | bigint | null }) {
  const provider = getProvider();
  const tokenId = token.id as string;
  const contractAddress = token.contractAddress as string;
  const lastScanned = Number(token.lastBlockScanned ?? 0);

  await markTokenSyncing(tokenId);

  try {
  const head = await getHeadBlockCached(provider);
  const requestedReindex = token.reindexFrom != null ? Number(token.reindexFrom) : null;
  const nextFrom = requestedReindex != null && Number.isFinite(requestedReindex) && requestedReindex > 0 ? requestedReindex : lastScanned + 1;
    const to = Math.min(nextFrom + BATCH_BLOCKS - 1, head);

    if (nextFrom > to) {
      // nothing to scan; mark complete
      await markTokenComplete(tokenId);
      return;
    }

    console.log(`Scanning ${contractAddress} blocks ${nextFrom}..${to}`);
  const transfers = await scanRange(provider, tokenId, contractAddress, nextFrom, to);
    if (transfers.length) {
      await insertTransfers(transfers);
    }

    await updateLastBlockScanned(tokenId, BigInt(to));
    if (requestedReindex != null) {
      await clearReindexFrom(tokenId);
    }

    // Reorg safety window: avoid marking complete right at head; wait until within a safe distance
    const SAFETY = Math.max(0, Number(process.env.REORG_SAFETY_BLOCKS || 5));
    const safeHead = Math.max(0, head - SAFETY);
    if (to >= safeHead) {
      await markTokenComplete(tokenId);
      console.log(`Token ${contractAddress} sync complete (safe within ${SAFETY} blocks of head)`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't spam logs on rate limits - these are expected with free RPCs
    if (msg.includes("Cannot fulfill") || msg.includes("429") || msg.includes("rate")) {
      console.warn(`RPC rate limit for ${contractAddress}, will retry next cycle`);
    } else {
      console.error("indexer token error", err);
    }
    // Don't rethrow - let the token retry in next poll cycle
  }
}

async function mainLoop() {
  console.log("Indexer starting — poll interval", POLL_INTERVAL_MS, "batch", BATCH_BLOCKS, "concurrency", INDEXER_CONCURRENCY);
  const queue = new PQueue({ concurrency: INDEXER_CONCURRENCY });
  while (true) {
    try {
      const tokens = await getPendingTokens(INDEXER_CONCURRENCY);
      if (!tokens || tokens.length === 0) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      for (const t of tokens) {
        const tok = t as unknown as { id: string; contractAddress: string; lastBlockScanned?: string | number };
        queue.add(() => processToken(tok));
      }

      await queue.onIdle();
    } catch (err) {
      console.error("indexer loop error", err);
      await sleep(5000);
    }
  }
}

if (require.main === module) {
  mainLoop().catch(err => {
    console.error("indexer fatal", err);
    process.exit(1);
  });
}

export default mainLoop;
