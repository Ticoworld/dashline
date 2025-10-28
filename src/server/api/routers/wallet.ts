import { z } from "zod";
import { router, protectedProcedure, rateLimited } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
// Minimal on-chain balance via ethers provider to avoid third-party dependency
import { cacheService } from "@/server/services/cacheService";
import { contractAddressSchema, timeRangeSchema } from "@/lib/validators";
import { formatWeiToDecimal } from "@/lib/formatters";

export const walletRouter = router({
  getOverview: protectedProcedure
    .use(rateLimited)
    .input(z.object({ address: contractAddressSchema, timeRange: timeRangeSchema.optional().default("7d") }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tr = input.timeRange ?? "7d";
      const key = `wallet:overview:${input.address}:${tr}`;
      return cacheService.wrap(key, async () => {
        // Placeholder: no third-party tx aggregation here; return mock trending series
        const now = new Date();
        const days = tr === "24h" ? 2 : tr === "7d" ? 7 : tr === "30d" ? 30 : tr === "90d" ? 90 : 60;
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const txSeries = Array.from({ length: days }).map((_, i) => {
          const d = new Date(start);
          d.setUTCDate(start.getUTCDate() + i);
          return { date: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(50 + Math.sin(i / 3) * 10 + i * 2)) };
        });
        const totalTx = txSeries.at(-1)?.count ?? 0;
        return {
          totalTx,
          change: txSeries.length > 1 ? totalTx - (txSeries.at(-2)?.count ?? 0) : 0,
          chartData: txSeries.map((p) => ({ date: p.date, value: p.count })),
        };
      }, 60 * 5);
    }),
  getTokenBalances: protectedProcedure
    .use(rateLimited)
    .input(z.object({ contractAddress: contractAddressSchema.optional(), walletAddress: contractAddressSchema.optional(), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const wallet = input.walletAddress ?? "";
  const contract = input.contractAddress ?? "";
      // For MVP: return the single contract balance if provided, otherwise return empty list
      if (!wallet) return { balances: [] };
      if (!contract) return { balances: [] };
      // Read ERC20 balance via RPC
      try {
        const Ethers = await import("ethers");
        const provider = new Ethers.JsonRpcProvider(
          process.env.QUICKNODE_RPC ||
            (process.env.ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}` : undefined) ||
            (process.env.INFURA_KEY ? `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}` : undefined) ||
            process.env.PUBLIC_RPC_URL ||
            "https://rpc.ankr.com/eth"
        );
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const c = new Ethers.Contract(contract, abi, provider);
        const [raw, dec] = await Promise.all([c.balanceOf(wallet), c.decimals().catch(() => 18)]);
        const balance = formatWeiToDecimal(String(raw ?? "0"), Number(dec ?? 18), 6);
        return { balances: [{ contractAddress: contract, balance }] };
      } catch {
        return { balances: [] };
      }
    }),
});

export default walletRouter;
