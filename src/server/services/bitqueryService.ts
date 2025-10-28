import axios from "axios";
import { withRateLimit } from "./rateLimiter";
import { metrics } from "./observability";

type SeriesPoint = { x: string; y: number };
// PATCH 1: Change balance type to bigint
type TopHolder = { address: string; balance: bigint };

// Map app chain -> Bitquery EVM network key
function mapToEvmNetwork(chain: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("eth")) return "eth";
  if (c.includes("polygon") || c.includes("matic")) return "polygon";
  if (c.includes("base")) return "base";
  if (c.includes("arb") || c.includes("arbitrum")) return "arb";
  return "eth";
}

const BITQUERY_ENDPOINT = "https://graphql.bitquery.io";

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	const key = process.env.BITQUERY_API_KEY;
	if (!key) {
		metrics.inc("providers.bitquery.missing_key");
		throw new Error("BITQUERY_API_KEY missing");
	}
	return withRateLimit("bitquery", async () => {
		const t0 = Date.now();
		try {
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			// Bitquery supports either X-API-KEY or Authorization: Bearer <token> (new tokens look like ory_at_*)
			if (key.startsWith("ory_") || key.startsWith("ory.at") || key.startsWith("ory_at_")) {
				headers["Authorization"] = `Bearer ${key}`;
			} else {
				headers["X-API-KEY"] = key;
			}
			const r = await axios.post(BITQUERY_ENDPOINT, { query, variables }, { headers, timeout: 15000 });
			const ms = Date.now() - t0;
			metrics.inc("providers.bitquery.calls");
			metrics.inc(`providers.bitquery.latency_ms.${Math.min(2000, Math.ceil(ms / 100) * 100)}`);
			return r.data as T;
		} catch (e: unknown) {
			metrics.inc("providers.bitquery.errors");
			// Attempt to surface short error info for diagnostics
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ax = e as any;
				const status = ax?.response?.status;
				const message = ax?.response?.data?.errors?.[0]?.message || ax?.message || "unknown";
				metrics.inc(`providers.bitquery.http.${status ?? "unknown"}`);
				metrics.inc(`providers.bitquery.err.${String(message).slice(0,50)}`);
			} catch {}
			throw e;
		}
	});
}

export const bitqueryService = {
  // Use EVM TokenHolders to get total unique holders with positive balance
  async getTokenHolderCount(contractAddress: string, chain: string): Promise<{ total?: number; source: "bitquery" } | { total?: number; source: "mock" }> {
    const network = mapToEvmNetwork(chain);
    const today = new Date().toISOString().slice(0, 10);
    const q = `
      query HolderCount($network: EVMNetwork!, $date: Date!, $address: String!) {
        EVM(dataset: archive, network: $network) {
          TokenHolders(
            date: $date,
            tokenSmartContract: $address,
            where: { Balance: { Amount: { gt: "0" } } }
          ) {
            uniq(of: Holder_Address)
          }
        }
      }
    `;
    try {
      const resp = await postGraphQL<{ data?: { EVM?: { TokenHolders?: Array<{ uniq?: number }> } } }>(q, {
        network,
        date: today,
        address: contractAddress,
      });
      const total = Number(resp?.data?.EVM?.TokenHolders?.[0]?.uniq ?? 0);
      return { total, source: "bitquery" } as const;
    } catch {
      return { total: undefined, source: "mock" } as const;
    }
  },

  // Use EVM TokenHolders list ordered by Balance_Amount to get top holders
  // PATCH 2: Update return type to use new TopHolder type
  async getTopHolders(contractAddress: string, chain: string, limit = 50): Promise<{ topHolders?: TopHolder[]; source: "bitquery" } | { topHolders?: TopHolder[]; source: "mock" }> {
    const network = mapToEvmNetwork(chain);
    const today = new Date().toISOString().slice(0, 10);
    const q = `
      query TopHolders($network: EVMNetwork!, $date: Date!, $address: String!, $count: Int!) {
        EVM(dataset: archive, network: $network) {
          TokenHolders(
            date: $date,
            tokenSmartContract: $address,
            where: { Balance: { Amount: { gt: "0" } } },
            orderBy: { descending: Balance_Amount },
            limit: { count: $count }
          ) {
            Holder { Address }
            Balance { Amount }
          }
        }
      }
    `;
    try {
      const data = await postGraphQL<{ data?: { EVM?: { TokenHolders?: Array<{ Holder?: { Address?: string }; Balance?: { Amount?: string | number } }> } } }>(q, {
        network,
        date: today,
        address: contractAddress,
        count: Math.min(200, Math.max(1, limit)),
      });
      const rows = data?.data?.EVM?.TokenHolders ?? [];
      const top = rows
        // PATCH 3: Use BigInt for balance and handle "0" default
        .map((r) => ({ address: String(r?.Holder?.Address ?? ""), balance: BigInt(String(r?.Balance?.Amount ?? "0")) }))
        .filter((r) => r.address)
        .slice(0, limit);
      return { topHolders: top, source: "bitquery" } as const;
    } catch {
      return { topHolders: [], source: "mock" } as const;
    }
  },

	async getHolderSeries(
		contractAddress: string,
		chain: string,
		fromDate: string,
		toDate: string,
		_interval: "day" | "week" = "day"
	): Promise<{ series?: SeriesPoint[]; source: "bitquery" } | { series?: SeriesPoint[]; source: "mock" }> {
		// For now, keep using transfers-based distinct receivers but fix the uniq field and provide correct filters.
		void _interval; // not used in current query
		const networkOld = ((): string => {
			const c = (chain || "").toLowerCase();
			if (c.includes("eth")) return "ethereum";
			if (c.includes("polygon") || c.includes("matic")) return "polygon";
			if (c.includes("base")) return "base";
			if (c.includes("arb") || c.includes("arbitrum")) return "arbitrum";
			return "ethereum";
		})();
		const q = `
			query HolderDaily($network: EthereumNetwork!, $address: String!, $since: ISO8601DateTime, $till: ISO8601DateTime) {
				ethereum(network: $network) {
					transfers(
						date: {since: $since, till: $till}
						currency: {is: $address}
					) {
						date: date { date }
						distinctReceivers: count(uniq: receiver)
					}
				}
			}
		`;
		try {
			const resp = await postGraphQL<{ data?: { ethereum?: { transfers?: Array<{ date?: { date?: string }; distinctReceivers?: number }> } } }>(q, {
				network: networkOld,
				address: contractAddress,
				since: fromDate,
				till: toDate,
			});
			const rows = resp?.data?.ethereum?.transfers ?? [];
			const series: SeriesPoint[] = rows
				.map((r) => ({ x: String(r?.date?.date ?? "").slice(0, 10), y: Number(r?.distinctReceivers ?? 0) }))
				.filter((p) => Boolean(p.x));
			return { series, source: "bitquery" } as const;
		} catch {
			return { series: [], source: "mock" } as const;
		}
	},

		async getTxSeries(
			address: string,
			chain: string,
			days: number
		): Promise<{ series: Array<{ date: string; count: number }>; source: "bitquery" | "mock" }> {
			const network = ((): string => {
				const c = (chain || "").toLowerCase();
				if (c.includes("eth")) return "ethereum";
				if (c.includes("polygon") || c.includes("matic")) return "polygon";
				if (c.includes("base")) return "base";
				if (c.includes("arb") || c.includes("arbitrum")) return "arbitrum";
				return "ethereum";
			})();
			const q = `
				query TxDaily($network: EthereumNetwork!, $address: String!, $days: Int!) {
					ethereum(network: $network) {
						transfers(
							options: {desc: ["date.date"], limit: $days}
							any: [{sender: {is: $address}}, {receiver: {is: $address}}]
						) {
							date: date { date }
							c: count
						}
					}
				}
			`;
			try {
				const r = await postGraphQL<{ data?: { ethereum?: { transfers?: Array<{ date?: { date?: string }; c?: number }> } } }>(q, { network, address, days });
				const rows = r?.data?.ethereum?.transfers ?? [];
				const series = rows
					.map((r) => ({ date: String(r?.date?.date ?? "").slice(0, 10), count: Number(r?.c ?? 0) }))
					.filter((p) => p.date)
					.reverse();
				return { series, source: "bitquery" } as const;
			} catch {
				return { series: [], source: "mock" } as const;
			}
		},
};

export default bitqueryService;