import axios from "axios";
import { withRateLimit } from "./rateLimiter";
import { metrics } from "./observability";

type SeriesPoint = { x: string; y: number };

// Bitquery TokenHolders returns normalized decimal amounts.
// Keep as number here, and compute shares later against normalized totalSupply.
export type BitqueryTopHolder = { address: string; balance: number };

function mapToEvmNetwork(chain: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("eth")) return "eth";
  if (c.includes("polygon") || c.includes("matic")) return "matic";
  if (c.includes("base")) return "base";
  if (c.includes("arb") || c.includes("arbitrum")) return "arbitrum";
  return "eth";
}

// Use v2 Streaming API endpoint
const BITQUERY_ENDPOINT = "https://streaming.bitquery.io/eap";

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.BITQUERY_API_KEY;
  if (!key) {
    metrics.inc("providers.bitquery.missing_key");
    throw new Error("BITQUERY_API_KEY missing");
  }
  return withRateLimit("bitquery", async () => {
    const t0 = Date.now();
    try {
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}` // v2 API uses Bearer token
      };
      
      console.log("[bitquery] Calling API with query:", query.slice(0, 100) + "...");
      console.log("[bitquery] Variables:", JSON.stringify(variables, null, 2));
      
      const r = await axios.post(BITQUERY_ENDPOINT, { query, variables }, { headers, timeout: 30000 });
      const ms = Date.now() - t0;
      
      console.log("[bitquery] Response status:", r.status);
      console.log("[bitquery] Response data:", JSON.stringify(r.data, null, 2));
      
      metrics.inc("providers.bitquery.calls");
      metrics.inc(`providers.bitquery.latency_ms.${Math.min(2000, Math.ceil(ms / 100) * 100)}`);
      
      // Check for errors in response
      if (r.data?.errors && r.data.errors.length > 0) {
        console.error("[bitquery] GraphQL errors:", r.data.errors);
        metrics.inc("providers.bitquery.graphql_errors");
      }
      
      return r.data as T;
    } catch (e: unknown) {
      metrics.inc("providers.bitquery.errors");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ax = e as any;
        const status = ax?.response?.status;
        const message = ax?.response?.data?.errors?.[0]?.message || ax?.message || "unknown";
        console.error("[bitquery] API Error:", {
          status,
          message,
          data: ax?.response?.data
        });
        metrics.inc(`providers.bitquery.http.${status ?? "unknown"}`);
        metrics.inc(`providers.bitquery.err.${String(message).slice(0, 50)}`);
      } catch {}
      throw e;
    }
  });
}

export const bitqueryService = {
  // Holder count using EVM v2 API
  async getTokenHolderCount(
    contractAddress: string,
    chain: string
  ): Promise<{ total?: number; source: "bitquery" } | { total?: number; source: "mock" }> {
    const network = mapToEvmNetwork(chain);
    
    // BitQuery v2 Streaming API query for holder count
    const q = `
      query ($network: evm_network, $token: String!) {
        EVM(network: $network) {
          BalanceUpdates(
            where: {
              Currency: {SmartContract: {is: $token}}
              BalanceUpdate: {Amount: {gt: "0"}}
            }
            limitBy: {by: BalanceUpdate_Address, count: 1}
            limit: {count: 100000}
          ) {
            count
          }
        }
      }
    `;
    
    try {
      console.log(`[bitquery] getTokenHolderCount for ${contractAddress} on ${network}`);
      const resp = await postGraphQL<{ 
        data?: { 
          EVM?: { 
            BalanceUpdates?: Array<{ count?: number }> 
          } 
        } 
      }>(q, {
        network,
        token: contractAddress,
      });
      
      const total = Number(resp?.data?.EVM?.BalanceUpdates?.[0]?.count ?? 0);
      console.log(`[bitquery] Holder count result: ${total}`);
      return { total, source: "bitquery" } as const;
    } catch (err) {
      console.error("[bitquery] getTokenHolderCount failed:", err);
      return { total: undefined, source: "mock" } as const;
    }
  },

  // Top holders using EVM v2 API
  async getTopHolders(
    contractAddress: string,
    chain: string,
    limit = 50
  ): Promise<{ topHolders?: BitqueryTopHolder[]; source: "bitquery" } | { topHolders?: BitqueryTopHolder[]; source: "mock" }> {
    const network = mapToEvmNetwork(chain);
    
    // BitQuery v2 Streaming API query for top holders
    const q = `
      query ($network: evm_network, $token: String!, $limit: Int!) {
        EVM(network: $network) {
          BalanceUpdates(
            where: {
              Currency: {SmartContract: {is: $token}}
            }
            orderBy: {descendingByField: "balance"}
            limit: {count: $limit}
          ) {
            BalanceUpdate {
              Address
            }
            balance: sum(of: BalanceUpdate_Amount, selectWhere: {ge: "0"})
          }
        }
      }
    `;
    
    try {
      console.log(`[bitquery] getTopHolders for ${contractAddress} on ${network}, limit: ${limit}`);
      const data = await postGraphQL<{
        data?: {
          EVM?: {
            BalanceUpdates?: Array<{ 
              BalanceUpdate?: { Address?: string }; 
              balance?: string | number 
            }>;
          };
        };
      }>(q, {
        network,
        token: contractAddress,
        limit: Math.min(200, Math.max(1, limit)),
      });
      
      const rows = data?.data?.EVM?.BalanceUpdates ?? [];
      const top: BitqueryTopHolder[] = rows
        .map((r) => ({
          address: String(r?.BalanceUpdate?.Address ?? "").toLowerCase(),
          balance: Number(r?.balance ?? 0),
        }))
        .filter((r) => r.address && Number.isFinite(r.balance) && r.balance > 0);
      
      console.log(`[bitquery] Top holders result: ${top.length} holders found`);
      if (top.length > 0) {
        console.log(`[bitquery] Sample holder:`, top[0]);
      }
      
      return { topHolders: top.slice(0, limit), source: "bitquery" } as const;
    } catch (err) {
      console.error("[bitquery] getTopHolders failed:", err);
      return { topHolders: [], source: "mock" } as const;
    }
  },

  // Daily distinct receivers for a token (old cube). Use explicit since/till to avoid empty results.
  async getHolderSeries(
    contractAddress: string,
    chain: string,
    fromDate: string,
    toDate: string,
    _interval: "day" | "week" = "day"
  ): Promise<{ series?: SeriesPoint[]; source: "bitquery" } | { series?: SeriesPoint[]; source: "mock" }> {
    void _interval;
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
      const resp = await postGraphQL<{ data?: { ethereum?: { transfers?: Array<{ date?: { date?: string }; distinctReceivers?: number }> } } }>(
        q,
        { network: networkOld, address: contractAddress, since: fromDate, till: toDate }
      );
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
    // Use explicit range rather than 'since: "-"'
    const till = new Date();
    const since = new Date(Date.UTC(till.getUTCFullYear(), till.getUTCMonth(), till.getUTCDate()));
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const q = `
      query TxDaily($network: EthereumNetwork!, $address: String!, $since: ISO8601DateTime, $till: ISO8601DateTime) {
        ethereum(network: $network) {
          transfers(
            date: {since: $since, till: $till}
            any: [{sender: {is: $address}}, {receiver: {is: $address}}]
          ) {
            date: date { date }
            c: count
          }
        }
      }
    `;
    try {
      const r = await postGraphQL<{ data?: { ethereum?: { transfers?: Array<{ date?: { date?: string }; c?: number }> } } }>(q, {
        network,
        address,
        since: since.toISOString(),
        till: till.toISOString(),
      });
      const rows = r?.data?.ethereum?.transfers ?? [];
      const series = rows
        .map((r) => ({ date: String(r?.date?.date ?? "").slice(0, 10), count: Number(r?.c ?? 0) }))
        .filter((p) => p.date)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return { series, source: "bitquery" } as const;
    } catch {
      return { series: [], source: "mock" } as const;
    }
  },
};

export default bitqueryService;