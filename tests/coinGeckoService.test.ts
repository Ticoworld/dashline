import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { coinGeckoService } from '@/server/services/coinGeckoService';

vi.mock('axios');
const mockedGet = vi.mocked(axios.get);

describe('coinGeckoService.getTokenPrice', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('returns data from contract endpoint when available', async () => {
  mockedGet.mockResolvedValueOnce({ data: { market_data: { current_price: { usd: 2 }, price_change_percentage_24h: 1.5, market_cap: { usd: 5000 }, total_volume: { usd: 200 } } } } as never);
    const res = await coinGeckoService.getTokenPrice('0xabc', 'ethereum');
    expect(res.price).toBe(2);
    expect(res.change24h).toBe(1.5);
    expect(res.marketCap).toBe(5000);
    expect(res.volume24h).toBe(200);
  });

  it('falls back to simple endpoint', async () => {
    // contract endpoint is retried 3 times; reject 3 times
    mockedGet
      .mockRejectedValueOnce(new Error('contract endpoint error'))
      .mockRejectedValueOnce(new Error('contract endpoint error'))
      .mockRejectedValueOnce(new Error('contract endpoint error'))
      // then fallback simple endpoint call resolves
      .mockResolvedValueOnce({ data: { '0xabc': { usd: 3, usd_24h_change: 2, usd_market_cap: 10000, usd_24h_vol: 300 } } } as never);
    const res = await coinGeckoService.getTokenPrice('0xabc', 'ethereum');
    expect(res.price).toBe(3);
    expect(res.change24h).toBe(2);
    expect(res.marketCap).toBe(10000);
    expect(res.volume24h).toBe(300);
  });
});
