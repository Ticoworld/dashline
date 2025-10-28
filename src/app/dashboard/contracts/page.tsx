"use client";
import React, { useEffect } from "react";
import { useDashboardContext } from "@/context/DashboardContext";
import { api } from "@/lib/trpc";
import MetricCard from "@/components/cards/MetricCard";
import ChartCard from "@/components/cards/ChartCard";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import TableCard from "@/components/cards/TableCard";
import EmptyState from "@/components/ui/EmptyState";

export default function ContractPage() {
  const ctx = useDashboardContext();
  const projectId = ctx?.projectId ?? null;
  const timeRange = ctx?.timeRange ?? "7d";

  const { data, isLoading, isError, refetch } = api.metrics.getOverview.useQuery(
    { projectId: projectId ?? "", timeRange },
    { enabled: !!projectId }
  );

  useEffect(() => {
    if (projectId) refetch();
  }, [projectId, refetch]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState title="No project selected" subtitle="Select or connect a project to view contract analytics." primaryAction={{ label: "Connect project", onClick: () => window.location.href = "/dashboard/connect" }} />
      </div>
    );
  }

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-400">Failed to load contract analytics</div>;

  const holders = data?.holders ?? { totalHolders: 0, change: 0, changePercent: 0, chartData: [] };
  const volume = data?.volume ?? { volume24h: 0, volumeChange: 0, chartData: [] };
  const price = data?.price ?? { price: 0, change24h: 0, marketCap: 0, volume24h: 0 };
  type HolderPoint = { date: string; holders?: number; value?: number };
  type VolumePoint = { date: string; volume?: number; value?: number };
  // API returns capitalized keys already formatted for table display: { Address, Balance, Share }
  type TopRow = { Address: string; Balance: number | string; Share: string };
  const topRows: TopRow[] = (data && (data as { topHolders?: TopRow[] }).topHolders ? (data as { topHolders?: TopRow[] }).topHolders! : []) as TopRow[];
  const transactions = data && (data as { transactions?: { totalTx?: number; change?: number; chartData?: { date: string; count?: number }[] } }).transactions ? (data as { transactions?: { totalTx?: number; change?: number; chartData?: { date: string; count?: number }[] } }).transactions! : { totalTx: 0, change: 0, chartData: [] };

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Holders" value={holders.totalHolders} change={holders.changePercent} changeType={holders.changePercent > 0 ? "increase" : "decrease"} onRetry={refetch} />
        <MetricCard title="24h Volume" value={`$${(volume.volume24h / 1000).toFixed(1)}k`} change={volume.volumeChange} changeType={volume.volumeChange > 0 ? "increase" : "decrease"} onRetry={refetch} />
        <MetricCard title="Token Price" value={`$${price.price.toFixed(2)}`} change={price.change24h} changeType={price.change24h > 0 ? "increase" : "decrease"} onRetry={refetch} />
  <MetricCard title="Active Wallets" value={transactions.totalTx ?? 0} change={transactions.change ?? 0} changeType={(transactions.change ?? 0) > 0 ? "increase" : "decrease"} onRetry={refetch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Holder Growth" subtitle="Address count over time" exportable loading={isLoading} empty={holders.chartData.length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <LineChart data={holders.chartData.map((p: HolderPoint) => ({ date: p.date, value: p.holders ?? p.value ?? 0 }))} />
        </ChartCard>

        <ChartCard title="Transaction Volume" subtitle="Protocol-wide" exportable loading={isLoading} empty={volume.chartData.length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <BarChart data={volume.chartData.map((p: VolumePoint) => ({ date: p.date, value: p.volume ?? p.value ?? 0 }))} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Holders" subtitle="Ranked by balance" loading={isLoading} empty={topRows.length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <TableCard title="Top Holders" columns={["Address", "Balance", "Share"]} data={topRows} loading={false} onRetry={refetch} />
        </ChartCard>
      </div>
    </div>
  );
}
