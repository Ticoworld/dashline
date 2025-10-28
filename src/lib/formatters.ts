export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function formatCurrency(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n}`;
}

export function formatPercentage(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(d: string | Date | number) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

// Convert a smallest-unit integer (like wei) represented as string to a decimal string
export function formatWeiToDecimal(wei: string | number | bigint, decimals = 18, precision = 6): string {
  try {
    const bi = typeof wei === 'bigint' ? wei : BigInt(String(wei ?? '0'));
    const neg = bi < BigInt(0);
    const abs = neg ? -bi : bi;
    const factor = BigInt(10) ** BigInt(decimals);
    const whole = abs / factor;
    const frac = abs % factor;
    if (frac === BigInt(0)) return `${neg ? '-' : ''}${whole.toString()}`;
    // Build fractional with fixed precision
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, precision);
    // Trim trailing zeros
    const trimmed = fracStr.replace(/0+$/, '');
    return `${neg ? '-' : ''}${whole.toString()}${trimmed ? '.' + trimmed : ''}`;
  } catch {
    return '0';
  }
}

// Format a decimal string (e.g., "1234.5678") into a compact display (e.g., 1.23k)
export function formatDecimalBalance(dec: string, digits = 4): string {
  if (!dec) return "0";
  const neg = dec.startsWith("-");
  const s = neg ? dec.slice(1) : dec;
  const [whole, frac = ""] = s.split(".");
  const nWhole = Number(whole);
  if (!isFinite(nWhole)) return dec;
  const sign = neg ? "-" : "";
  const abs = Math.abs(nWhole);
  const suffix = abs >= 1_000_000_000 ? "B" : abs >= 1_000_000 ? "M" : abs >= 1_000 ? "k" : "";
  let base = abs;
  if (suffix === "B") base = abs / 1_000_000_000;
  else if (suffix === "M") base = abs / 1_000_000;
  else if (suffix === "k") base = abs / 1_000;
  if (!suffix) {
    const trimmed = frac.slice(0, digits).replace(/0+$/, "");
    return trimmed ? `${sign}${whole}.${trimmed}` : `${sign}${whole}`;
  }
  return `${sign}${base.toFixed(2)}${suffix}`;
}
