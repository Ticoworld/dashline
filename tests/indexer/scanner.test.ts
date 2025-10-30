import { describe, it, expect } from "vitest";
import { Interface, EventFragment } from "ethers";
import { scanRange } from "@/services/indexer/scanner";

describe("scanner.scanRange", () => {
  it("parses a single Transfer log", async () => {
    const iface = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const from = "0x0000000000000000000000000000000000123456";
    const to = "0x0000000000000000000000000000000000654321";
  const value = BigInt("1230000000000000000"); // 1.23 tokens

  const encoded = iface.encodeEventLog(iface.getEvent("Transfer") as unknown as EventFragment, [from, to, value]);

    const mockProvider = {
      getLogs: async () => [
        {
          topics: encoded.topics,
          data: encoded.data,
          blockNumber: 1000,
          logIndex: 0,
          transactionHash: "0xtxhash",
        },
      ],
  getBlock: async () => ({ timestamp: 1700000000 }),
    };

  const result = await scanRange(mockProvider as unknown, "token123", "0xContract", 900, 1100);
    expect(result.length).toBe(1);
    const r = result[0];
    expect(r.from.toLowerCase()).toBe(from.toLowerCase());
    expect(r.to.toLowerCase()).toBe(to.toLowerCase());
    expect(r.txHash).toBe("0xtxhash");
    expect(r.blockNumber).toBe(1000);
  });
});
