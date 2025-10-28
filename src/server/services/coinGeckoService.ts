import axios from "axios";
import { isOpen, recordFailure, recordSuccess } from "./circuitBreaker";
import { metrics } from "./observability";

function mapChainToPlatform(chain: string): string {
  switch (chain.toLowerCase()) {
    case "ethereum":
      return "ethereum";
    case "polygon":
      return "polygon-pos";
    case "base":
      return "base";
    case "arbitrum":
      return "arbitrum-one";
    default:
      return "ethereum";
  }
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const delay = baseDelayMs * 2 ** i + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new Error(String(lastErr));
}

export const coinGeckoService = {
  async getTokenPrice(
    contractAddress: string,
    chain: string = "ethereum"
  ): Promise<{
    price: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
    // Non-breaking additive metadata to surface source/fallbacks to the UI
    source?: "coingecko" | "dexscreener" | "mock";
  }> {
    const cbKey = `coingecko:price:${contractAddress}`;
  if (await isOpen(cbKey)) {
      metrics.inc('coingecko.shortcircuited');
      console.warn('[coingecko] circuit open, short-circuiting getTokenPrice');
      return { price: 0, change24h: 0, marketCap: 0, volume24h: 0, source: "mock" };
    }
    console.log("[coingecko] getTokenPrice", { contractAddress, chain });
    try {
      const platform = mapChainToPlatform(chain);
      // Try contract endpoint first for richer data
      const contractUrl = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}`;
      try {
        const res = await retry(() => axios.get(contractUrl, { timeout: 10000 }));
        const marketData = res.data?.market_data ?? {};
  await recordSuccess(cbKey);
        metrics.inc('coingecko.price.success');
        return {
          price: Number(marketData?.current_price?.usd ?? 0),
          change24h: Number(marketData?.price_change_percentage_24h ?? 0),
          marketCap: Number(marketData?.market_cap?.usd ?? 0),
          volume24h: Number(marketData?.total_volume?.usd ?? 0),
          source: "coingecko",
        };
  } catch {
  metrics.inc('coingecko.price.failure');
        // Fallback to simple token price endpoint
        try {
          const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}`;
          const { data } = await axios.get(url, {
            params: {
              contract_addresses: contractAddress,
              vs_currencies: "usd",
              include_24hr_change: true,
              include_market_cap: true,
              include_24hr_vol: true,
            },
            timeout: 10000,
          });
          const key = contractAddress.toLowerCase();
          const entry = data[key] || Object.values(data)[0] || {};
          await recordSuccess(cbKey);
          metrics.inc('coingecko.price.success');
          const simplePrice = Number(entry.usd ?? 0);
          if (simplePrice > 0) {
            return {
              price: simplePrice,
              change24h: Number(entry.usd_24h_change ?? 0),
              marketCap: Number(entry.usd_market_cap ?? 0),
              volume24h: Number(entry.usd_24h_vol ?? 0),
              source: "coingecko",
            };
          }
          // If simple endpoint returned no data, fall through to Dexscreener
          throw new Error("coingecko simple returned empty");
        } catch (_err) {
          console.warn('[coingecko] contract+simple failed, trying dexscreener fallback', _err);
          // Dexscreener fallback for DEX-traded tokens
          try {
            const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
            const { data: ds } = await axios.get(dsUrl, { timeout: 10000 });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pairs: Array<any> = Array.isArray(ds?.pairs) ? ds.pairs : [];
            if (pairs.length > 0) {
              // Choose the pair with the highest USD liquidity
              const best = pairs.reduce((a, b) => {
                const la = Number(a?.liquidity?.usd ?? 0);
                const lb = Number(b?.liquidity?.usd ?? 0);
                return lb > la ? b : a;
              }, pairs[0]);
              const priceUsd = Number(best?.priceUsd ?? 0);
              const vol24 = Number(best?.volume?.h24 ?? 0);
              const changeH24 = Number(best?.priceChange?.h24 ?? 0);
              const mcap = Number(best?.marketCap ?? best?.fdv ?? 0);
              if (priceUsd > 0) {
                await recordSuccess(cbKey);
                metrics.inc('coingecko.price.success');
                return { price: priceUsd, change24h: changeH24, marketCap: mcap, volume24h: vol24, source: "dexscreener" };
              }
            }
            throw new Error('dexscreener returned no pairs/price');
          } catch (dexErr) {
            console.warn('[dexscreener] fallback failed, returning mock', dexErr);
            await recordFailure(cbKey);
            metrics.inc('coingecko.price.failure');
            return { price: 1.23, change24h: 2.1, marketCap: 1000000, volume24h: 12345, source: "mock" };
          }
        }
      }
    } catch (e) {
      console.warn("[coingecko] failed, returning mock", e);
      return { price: 1.23, change24h: 2.1, marketCap: 1000000, volume24h: 12345, source: "mock" };
    }
  },

  async getMarketData(contractAddress: string) {
    console.log("[coingecko] getMarketData", { contractAddress });
    const { price, change24h, marketCap, volume24h, source } = await this.getTokenPrice(contractAddress);
    return { price, change24h, marketCap, volume24h, circulatingSupply: 0, totalSupply: 0, source };
  },
};
