import "../../server/env";
import { getPendingTokens, markTokenSyncing, updateLastBlockScanned, markTokenComplete, insertTransfers } from "./dbClient";
import { getProvider } from "./rpcManager";
import { scanRange } from "./scanner";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 15_000);
const BATCH_BLOCKS = Number(process.env.BATCH_BLOCKS || 5_000);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processToken(token: { id: string; contractAddress: string; lastBlockScanned?: number | string }) {
  const provider = getProvider();
  const tokenId = token.id as string;
  const contractAddress = token.contractAddress as string;
  const lastScanned = Number(token.lastBlockScanned ?? 0);

  await markTokenSyncing(tokenId);

  try {
    const head = await provider.getBlockNumber();
  const nextFrom = lastScanned + 1;
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

    if (to >= head) {
      await markTokenComplete(tokenId);
      console.log(`Token ${contractAddress} sync complete`);
    }
  } catch (err) {
    console.error("indexer token error", err);
  }
}

async function mainLoop() {
  console.log("Indexer starting — poll interval", POLL_INTERVAL_MS, "batch", BATCH_BLOCKS);
  while (true) {
    try {
      const tokens = await getPendingTokens(2);
      if (!tokens || tokens.length === 0) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      for (const t of tokens) {
          const tok = t as unknown as { id: string; contractAddress: string; lastBlockScanned?: string | number };
          await processToken(tok);
        }
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
