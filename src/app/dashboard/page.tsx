"use client";
import React, { useEffect } from "react";
import { api } from "@/lib/trpc";
import MetricCard, { type MetricPoint } from "@/components/cards/MetricCard";
import ChartCard from "@/components/cards/ChartCard";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import PieChart from "@/components/charts/PieChart";
import TableCard from "@/components/cards/TableCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatNumber, formatDate } from "@/lib/formatters";
import { useDashboardContext } from "@/context/DashboardContext";
import { useRouter } from "next/navigation";

type ChartPoint = { date: string; value: number };
type LocalRange = "24h" | "7d" | "30d" | "90d" | "all";
type LocalRanges = {
  holders: LocalRange;
  volume: LocalRange;
  liquidity: LocalRange;
  topHolders: LocalRange;
};

export default function DashboardPage() {
  const ctx = useDashboardContext();
  const projectId = ctx?.projectId ?? null;
  const router = useRouter();

  const timeRange = ctx?.timeRange ?? "7d";
  const sync = ctx?.syncTimeRange ?? false;
  // Local per-card ranges when sync is OFF
  const [localRanges, setLocalRanges] = React.useState<LocalRanges>({
    holders: timeRange,
    volume: timeRange,
    liquidity: timeRange,
    topHolders: timeRange,
  });

  // Top holders pagination state (keep hooks at top level)
  const [topPage, setTopPage] = React.useState(1);
  const TOP_PAGE_SIZE = 10;
  const topOffset = (topPage - 1) * TOP_PAGE_SIZE;

  React.useEffect(() => {
    if (sync) {
      // when turning sync on, align locals to global
    setLocalRanges({ holders: timeRange, volume: timeRange, liquidity: timeRange, topHolders: timeRange });
    }
  }, [sync, timeRange]);
  const { data, isLoading, isError, error, refetch } = api.metrics.getOverview.useQuery(
    { projectId: projectId ?? "", timeRange },
    { enabled: !!projectId }
  );

  // IMPORTANT: Keep hooks at top-level and before any conditional returns
  const { data: topPageData, isLoading: topPageLoading, refetch: refetchTopPage } = api.metrics.getTopHolders.useQuery(
    { projectId: projectId ?? "", limit: TOP_PAGE_SIZE, offset: topOffset },
    { enabled: !!projectId }
  );

  useEffect(() => {
    if (projectId) refetch();
  }, [projectId, refetch]);

  // If the selected project does not exist for the current user (e.g., after switching accounts),
  // clear the selection so the dashboard can prompt for a valid project.
  useEffect(() => {
    // tRPC error shape contains data.code when thrown from the server
    const code = (error as unknown as { data?: { code?: string } } | undefined)?.data?.code;
    if (isError && code === "NOT_FOUND") {
      try {
        localStorage.removeItem("dashline.projectId");
      } catch {}
      ctx?.setProjectId(null);
    }
  }, [isError, error, ctx]);

  if (!projectId) {
    return (
      <div className="pt-20">
        {/* Empty state reinforced with actionable CTAs per audit */}
        <EmptyState
          title="No project selected"
          subtitle="Choose a project from the selector above or connect a contract to populate your dashboard."
          primaryAction={{
            label: "Connect contract",
            onClick: () => router.push("/dashboard/connect"),
          }}
          secondaryAction={{
            label: "Learn about data sources",
            onClick: () => router.push("/dashboard/help"),
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCard key={i} title="Loading" loading onRetry={refetch} />
        ))}
      </div>
    );
  }

  if (isError) {
    const code = (error as unknown as { data?: { code?: string } } | undefined)?.data?.code;
    if (code === "NOT_FOUND") {
      return (
        <div className="p-6">
          <div className="text-yellow-400">Selected project is unavailable. Please choose another project.</div>
        </div>
      );
    }
    return (
      <div className="p-6">
        <div className="text-red-400">Failed to load dashboard</div>
        <button onClick={() => refetch()} className="mt-2 px-3 py-2 bg-[#6366F1] rounded">
          Retry
        </button>
      </div>
    );
  }

  // Use mock if data is undefined
  type RawPoint = { date: string; holders?: number; value?: number; volume?: number };

  const holders = data?.holders ?? { totalHolders: 14523, change: 1200, changePercent: 8.2, chartData: [] as RawPoint[], source: "mock", lastUpdatedAt: Date.now() };
  const volume = data?.volume ?? { volume24h: 1234567, volumeChange: -23456, chartData: [] as RawPoint[], source: "mock", lastUpdatedAt: Date.now() };
  const price = data?.price ?? { price: 0.45, change24h: 12.1, marketCap: 12345678, volume24h: 12345, source: "mock", lastUpdatedAt: Date.now() } as { price: number; change24h: number; marketCap: number; volume24h: number; source?: string; lastUpdatedAt?: number | string };
  const transactions = data?.transactions ?? { totalTx: 1234, change: 10, chartData: [] as ChartPoint[], source: "mock", lastUpdatedAt: Date.now() };
  const extendedData = data as
    | (typeof data & {
        liquidity?: Array<{ name: string; value: number }>;
        topHolders?: Array<{ Address: string; Balance: string; Share: string }>;
      })
    | undefined;
  const baseLiquidity = extendedData?.liquidity ?? [];
  const showStubs = process.env.NEXT_PUBLIC_DEV_SHOW_STUBS === 'true' && process.env.NODE_ENV !== 'production';
  const liquidity = baseLiquidity.length === 0 && showStubs
    ? [
        { name: 'Uniswap', value: 45 },
        { name: 'Sushiswap', value: 25 },
        { name: 'Balancer', value: 15 },
        { name: 'Others', value: 15 },
      ]
    : baseLiquidity;
  const topHolders = extendedData?.topHolders ?? [];
  function formatPrice(v: number): string {
    if (!isFinite(v)) return "—";
    const abs = Math.abs(v);
    const decimals = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 4 : abs >= 0.001 ? 5 : 6;
    return `$${v.toFixed(decimals)}`;
  }

  // Data stub mode (dev-only): if enabled and arrays are empty, populate with mock data so charts render
  function genSeries(n = 24, base = 1000, jitter = 0.1): RawPoint[] {
    const out: RawPoint[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 60 * 60 * 1000);
      const delta = (Math.random() - 0.5) * 2 * jitter * base;
      base = Math.max(0, base + delta);
      out.push({ date: date.toISOString().slice(0, 19), value: Math.round(base) });
    }
    return out;
  }
  if (showStubs) {
    if (holders.chartData.length === 0) holders.chartData = genSeries(48, 1200, 0.05);
    if (volume.chartData.length === 0) volume.chartData = genSeries(48, 18000, 0.12).map((p) => ({ ...p, volume: p.value }));
  }

  // Build lightweight sparkline for price if backend doesn't provide a series
  function buildPriceSparkline(current: number, changePct: number, points = 24): MetricPoint[] {
    if (!isFinite(current)) return [];
    const start = changePct ? current / (1 + changePct / 100) : current;
    const step = (current - start) / Math.max(1, points - 1);
    const out: MetricPoint[] = [];
    for (let i = 0; i < points; i++) {
      const date = new Date(Date.now() - (points - 1 - i) * 60 * 60 * 1000).toISOString().slice(0, 19);
      out.push({ date, value: start + step * i });
    }
    return out;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <MetricCard title="Total Holders" value={formatNumber(holders.totalHolders)} change={holders.changePercent} changeType={holders.changePercent > 0 ? "increase" : "decrease"} changeFormat="percentage" onRetry={refetch} comparisonLabel={`vs last ${timeRange}`} lastUpdated={holders?.lastUpdatedAt ? formatDate(holders.lastUpdatedAt as unknown as string) : undefined} sparklineData={holders.chartData?.map((p: RawPoint) => ({ date: p.date, value: p.holders ?? p.value ?? 0 }))} />
  <MetricCard title="24h Volume" value={`$${(volume.volume24h / 1000).toFixed(1)}k`} change={volume.volumeChange} changeType={volume.volumeChange > 0 ? "increase" : "decrease"} changeFormat="currency" onRetry={refetch} comparisonLabel={`vs last ${timeRange}`} lastUpdated={volume?.lastUpdatedAt ? formatDate(volume.lastUpdatedAt as unknown as string) : undefined} sparklineData={volume.chartData?.map((p: RawPoint) => ({ date: p.date, value: p.volume ?? p.value ?? 0 }))} />
  <MetricCard
    title="Token Price"
    value={formatPrice(price.price)}
  change={price.change24h}
  changeType={price.change24h > 0 ? "increase" : "decrease"}
  changeFormat="percentage"
    onRetry={refetch}
    comparisonLabel={price?.source ? `source: ${price.source} · vs last ${timeRange}` : `vs last ${timeRange}`}
    lastUpdated={price?.lastUpdatedAt ? formatDate(price.lastUpdatedAt as unknown as string) : undefined}
    sparklineData={buildPriceSparkline(price.price, Number(price.change24h ?? 0))}
  />
  <MetricCard
    title="Active Wallets"
    value={formatNumber(transactions.totalTx)}
    change={transactions.change}
    changeType={transactions.change > 0 ? "increase" : "decrease"}
    changeFormat="number"
    onRetry={refetch}
    comparisonLabel={`vs last ${timeRange}`}
    lastUpdated={transactions?.lastUpdatedAt ? formatDate(transactions.lastUpdatedAt as unknown as string) : undefined}
    sparklineData={(transactions.chartData ?? []).map((p) => {
      const anyP = p as unknown as { count?: number; value?: number };
      return { date: (p as { date: string }).date, value: Number(anyP.count ?? anyP.value ?? 0) };
    })}
  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Holder Growth"
          subtitle="Address count over time"
          exportable
          loading={isLoading}
          empty={holders.chartData.length === 0}
          onRetry={refetch}
          timeRange={sync ? timeRange : localRanges.holders}
          onRangeChange={(range) => {
            if (sync) ctx?.setTimeRange(range);
            else setLocalRanges((prev) => ({ ...prev, holders: range }));
          }}
          lastUpdatedAt={(holders?.lastUpdatedAt ?? undefined) as unknown as number | string}
          dataSource={holders?.source}
          synthetic={Boolean((holders as unknown as { dataEmpty?: boolean }).dataEmpty)}
        >
          <LineChart data={holders.chartData.map((p: RawPoint) => ({ date: p.date, value: p.holders ?? p.value ?? 0 }))} />
        </ChartCard>

        <ChartCard
          title="Transaction Volume"
          subtitle="Protocol-wide"
          exportable
          loading={isLoading}
          empty={volume.chartData.length === 0}
          onRetry={refetch}
          timeRange={sync ? timeRange : localRanges.volume}
          onRangeChange={(range) => {
            if (sync) ctx?.setTimeRange(range);
            else setLocalRanges((prev) => ({ ...prev, volume: range }));
          }}
          lastUpdatedAt={(volume?.lastUpdatedAt ?? undefined) as unknown as number | string}
          dataSource={volume?.source}
          synthetic={Boolean((volume as unknown as { dataEmpty?: boolean }).dataEmpty)}
        >
          <BarChart data={volume.chartData.map((p: RawPoint) => ({ date: p.date, value: p.volume ?? p.value ?? 0 }))} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Liquidity Mix"
          subtitle="Share by pool"
          loading={isLoading}
          empty={liquidity.length === 0}
          onRetry={refetch}
          timeRange={sync ? timeRange : localRanges.liquidity}
          onRangeChange={(range) => {
            if (sync) ctx?.setTimeRange(range);
            else setLocalRanges((prev) => ({ ...prev, liquidity: range }));
          }}
          lastUpdatedAt={(data?.price?.lastUpdatedAt ?? undefined) as unknown as number | string}
          dataSource={data?.price?.source}
        >
          <PieChart data={liquidity.map((item: { name: string; value: number }) => ({ name: item.name, value: item.value }))} />
        </ChartCard>

        <ChartCard
          title="Top Holders"
          subtitle="Ranked by balance"
          loading={isLoading}
          empty={topHolders.length === 0}
          onRetry={refetch}
          timeRange={sync ? timeRange : localRanges.topHolders}
          onRangeChange={(range) => {
            if (sync) ctx?.setTimeRange(range);
            else setLocalRanges((prev) => ({ ...prev, topHolders: range }));
          }}
          lastUpdatedAt={(data?.holders?.lastUpdatedAt ?? undefined) as unknown as number | string}
          dataSource={data?.holders?.source}
        >
          <div className="flex flex-col h-full">
            {(() => {
              const rows = topPageData?.holders
                ? topPageData.holders.map((h) => ({ Address: h.address, Balance: String(h.balance), Share: `${(h.percentage ?? 0).toFixed(2)}%` }))
                : topHolders;
              return (
                <TableCard
                  title="Top Holders"
                  columns={["Address", "Balance", "Share"]}
                  data={rows as unknown as Array<{ Address: string; Balance: string; Share: string }>}
                  loading={topPageLoading}
                  onRetry={() => {
                    refetchTopPage();
                  }}
                  showHeader={false}
                  disableInnerScroll
                  resetKey={topPage}
                />
              );
            })()}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button disabled={topPage <= 1} onClick={() => setTopPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-white/6 text-sm">Prev</button>
              <div className="text-sm text-gray-300">Page {topPage}</div>
              <button onClick={() => setTopPage((p) => p + 1)} className="px-3 py-1 rounded bg-white/6 text-sm">Next</button>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
