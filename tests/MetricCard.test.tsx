import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MetricCard from '@/components/cards/MetricCard';

describe('MetricCard', () => {
  it('formats percentage change correctly', () => {
    render(<MetricCard title="Test" value={100} change={-12.3456} changeType="decrease" changeFormat="percentage" />);
    expect(screen.getByText(/-12.35%/)).toBeTruthy();
  });

  it('formats currency change correctly', () => {
    render(<MetricCard title="Vol" value="$1.0k" change={1234} changeType="increase" changeFormat="currency" />);
    // formatCurrency returns compact string like $1.23k; accept plus sign
    expect(screen.getByText(/\+\$/)).toBeTruthy();
  });
});
