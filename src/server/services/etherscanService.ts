import axios from "axios";
import { withRateLimit } from "./rateLimiter";

function baseUrl(chain: string): string {
	const c = (chain || "").toLowerCase();
	if (c.includes("eth")) return "https://api.etherscan.io/api";
	if (c.includes("sepolia")) return "https://api-sepolia.etherscan.io/api";
	// For non-ethereum chains, prefer Blockscout (not implemented here)
	return "https://api.etherscan.io/api";
}

export const etherscanService = {
	// Minimal daily transfer counts for an address (contract) by parsing recent logs
	async getTransferCountsDaily(contractAddress: string, chain: string, days: number): Promise<Array<{ date: string; count: number }>> {
		const key = process.env.ETHERSCAN_API_KEY;
		if (!key) return [];
		const url = baseUrl(chain);
		// Etherscan getLogs supports fromBlock/toBlock; for simplicity, fetch recent logs (last 10k blocks)
		const params = {
			module: "logs",
			action: "getLogs",
			address: contractAddress,
			fromBlock: "latest",
			toBlock: "latest",
			apikey: key,
		} as Record<string, string>;
		try {
			const { data } = await withRateLimit("coingecko", () => axios.get(url, { params, timeout: 10000 }));
			const logs: Array<{ timeStamp?: string }> = data?.result ?? [];
			// Normalize to last N days buckets
			const now = new Date();
			const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
			start.setUTCDate(start.getUTCDate() - (days - 1));
			const map = new Map<string, number>();
			for (let i = 0; i < days; i++) {
				const d = new Date(start);
				d.setUTCDate(start.getUTCDate() + i);
				map.set(d.toISOString().slice(0, 10), 0);
			}
			for (const l of logs) {
				const ts = l?.timeStamp ? new Date(Number(l.timeStamp) * 1000) : null;
				if (!ts) continue;
				const day = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate())).toISOString().slice(0, 10);
				if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
			}
			return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
		} catch {
			return [];
		}
	},
};

export default etherscanService;

