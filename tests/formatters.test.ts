import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, formatPercentage, formatDate, formatDecimalBalance } from '@/lib/formatters';

describe('formatters', () => {
  it('formatNumber adds separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formatCurrency compacts values', () => {
    expect(formatCurrency(1534000)).toBe('$1.53M');
    expect(formatCurrency(39100)).toBe('$39.1k');
  });

  it('formatPercentage clamps decimals', () => {
    expect(formatPercentage(-91.94847020933977)).toBe('-91.9%');
  });

  it('formatDate handles numbers and strings', () => {
    const now = Date.now();
    expect(typeof formatDate(now)).toBe('string');
    expect(typeof formatDate(new Date(now).toISOString())).toBe('string');
  });

  it('formatDecimalBalance compacts and trims', () => {
    expect(formatDecimalBalance('1234.5600')).toBe('1.23k');
    expect(formatDecimalBalance('10.5000')).toBe('10.5');
  });
});
