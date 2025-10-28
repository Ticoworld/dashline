import { describe, it, expect } from 'vitest';
import { __internal } from '../holdersService';

// Share calculations should handle burn and LP supply reductions

describe('holdersService calcShares', () => {
  it('computes total and circulating shares', () => {
    const holders = [
      { address: '0x0000000000000000000000000000000000000000', balance: BigInt(1000) },
      { address: '0xabc', balance: BigInt(9000) },
      { address: '0xlp', balance: BigInt(1000) },
    ];
  const res = __internal.calcShares(holders as Array<{ address: string; balance: bigint }>, 0, BigInt(12000), new Set(['0xlp']));
    const top = res.top;
    const a = top.find(t => t.address === '0xabc')!;
    expect(Math.round(a.totalSupplyShare * 1000)).toBe(750); // 9000/12000 = 0.75
    // circulating supply = 12000 - 1000(burn) - 1000(lp) = 10000 -> 9000/10000 = 0.9
    expect(Math.round(a.circulatingShare * 100)).toBe(90);
  });
});
