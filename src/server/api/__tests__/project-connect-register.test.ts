/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleProjectConnect } from "@/server/api/routers/project";
import * as indexerService from "@/server/services/indexerService";
import { prisma } from "@/server/db";
import { dexscreenerService } from "@/server/services/dexscreenerService";

describe("project.connect server-side token registration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls upsertTokenForIndexing when connecting a new project", async () => {
    // stub dexscreener
  vi.spyOn(dexscreenerService, "getTokenMetadata").mockResolvedValue({ name: "T", symbol: "T", logoUrl: undefined } as any);

  // stub prisma project findFirst/create
  vi.spyOn(prisma.project, "findFirst").mockResolvedValue(null as any);
  vi.spyOn(prisma.project, "create").mockResolvedValue({ id: "proj-1", name: "T", symbol: "T", logoUrl: undefined } as any);

  const upsertSpy = vi.spyOn(indexerService, "upsertTokenForIndexing").mockResolvedValue({ id: "tok-1", status: "pending" } as any);

  const input = { contractAddress: "0x0000000000000000000000000000000000123456", chain: "ethereum" };
  const res = await handleProjectConnect(input as any, { userId: "user-1" } as any);

  expect(upsertSpy).toHaveBeenCalled();
  expect(res).toHaveProperty("projectId", "proj-1");
  expect(res).toHaveProperty("tokenRegistered", true);
  });

  it("upsertTokenForIndexing preserves 'complete' status and does not downgrade", async () => {
    // mock existing token with status 'complete'
  const findSpy = vi.spyOn(prisma.token, "findUnique").mockResolvedValue({ id: "tok-1", status: "complete", contractAddress: "0xabc" } as any);
    const updateSpy = vi.spyOn(prisma.token, "update");

    const result = await indexerService.upsertTokenForIndexing({ contractAddress: "0xabc", chain: "ethereum" });

    expect(findSpy).toHaveBeenCalled();
    // should not attempt to update
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result).toHaveProperty("status", "complete");
  });
});
