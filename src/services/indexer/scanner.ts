import { Interface } from "ethers";
import { id } from "ethers";
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
  const filter = {
    address: contractAddress,
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock,
  };
  type ProviderLike = { getLogs: (...args: unknown[]) => Promise<unknown[]>; getBlock: (n: number) => Promise<{ timestamp: number }> };
  const p = provider as unknown as ProviderLike;
  const logs = await p.getLogs(filter);
  const transfers: TransferRow[] = [];
  type EthersRawLog = { topics: string[]; data: string; blockNumber?: number; transactionHash?: string; logIndex?: number };
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
  const block = await p.getBlock(blockNumber);
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
      // ignore parse errors for now
      console.warn("failed to parse log", err);
    }
  }
  return transfers;
}
