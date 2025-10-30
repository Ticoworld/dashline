/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ethers before importing the route so the route uses the mock
vi.mock("ethers", () => {
  return {
    Contract: function (_address: string, _abi: unknown, _provider: unknown) {
      return {
        decimals: async () => 18,
        name: async () => "MockToken",
        symbol: async () => "MTK",
      };
    },
    JsonRpcProvider: function () {
      return {
        getBlockNumber: async () => 123456,
      };
    },
  };
});

// Ensure env vars required by src/server/env exist for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/dashline_test";

import * as db from "@/server/db";
import { POST } from "@/app/api/tokens/register/route";

describe("POST /api/tokens/register", () => {
  beforeEach(() => {
    process.env.RPC_URLS = "http://mocked";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts token and returns 202", async () => {
    // stub prisma.token.upsert to avoid hitting DB
    (db.prisma as any).token = {
      upsert: vi.fn().mockResolvedValueOnce({ id: "tok-1", status: "pending" }),
    };
    const spy = (db.prisma as any).token.upsert;

    const mockReq = {
      json: async () => ({ contractAddress: "0x0000000000000000000000000000000000123456", chain: "ethereum" }),
    } as unknown as any;

    const res = await POST(mockReq as unknown as any);
    expect(res.status).toBe(202);
    const body = JSON.parse(await res.text());
    expect(body.id).toBe("tok-1");
    expect(body.status).toBe("pending");
    expect(spy).toHaveBeenCalled();
  });
});
