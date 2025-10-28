"use client";
import React, { useEffect } from "react";
import { useDashboardContext } from "@/context/DashboardContext";
import { api } from "@/lib/trpc";
import MetricCard from "@/components/cards/MetricCard";
import ChartCard from "@/components/cards/ChartCard";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";
import EmptyState from "@/components/ui/EmptyState";

export default function DeFiPage() {
  const ctx = useDashboardContext();
  const projectId = ctx?.projectId ?? null;
  const timeRange = ctx?.timeRange ?? "7d";

  const { data, isLoading, isError, refetch } = api.metrics.getOverview.useQuery({ projectId: projectId ?? "", timeRange }, { enabled: !!projectId });

  useEffect(() => { if (projectId) refetch(); }, [projectId, refetch]);

  if (!projectId) return (
    <div className="p-6">
      <EmptyState title="No project selected" subtitle="Connect a protocol to view DeFi metrics." primaryAction={{ label: "Connect project", onClick: () => window.location.href = "/dashboard/connect" }} />
    </div>
  );

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-400">Failed to load DeFi metrics</div>;

  // Mock TVL derived from price & volume for MVP
  const price = data?.price ?? { price: 0.5 };
  const volume = data?.volume ?? { volume24h: 0 };
  const tvl = (price.price * 1000000) || 0;

  type TxPoint = { date: string; count?: number };
  type VolumePoint = { date: string; volume?: number };
  const txSeries: TxPoint[] = data?.transactions?.chartData ? (data.transactions.chartData as TxPoint[]) : [];
  const volSeries: VolumePoint[] = (data && (data as { volume?: { chartData?: VolumePoint[] } }).volume && (data as { volume?: { chartData?: VolumePoint[] } }).volume!.chartData) ? (data as { volume?: { chartData?: VolumePoint[] } }).volume!.chartData! : [];

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="TVL" value={`$${(tvl / 1e6).toFixed(2)}M`} change={0} changeType="increase" onRetry={refetch} />
        <MetricCard title="24h Volume" value={`$${(volume.volume24h / 1000).toFixed(1)}k`} change={0} changeType="decrease" onRetry={refetch} />
        <MetricCard title="Open Interest" value={`$${(tvl * 0.2).toFixed(0)}`} change={0} changeType="increase" onRetry={refetch} />
        <MetricCard title="Active Users" value={data?.transactions?.totalTx ?? 0} change={data?.transactions?.change ?? 0} changeType={(data?.transactions?.change ?? 0) > 0 ? "increase" : "decrease"} onRetry={refetch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="TVL Over Time" subtitle="Estimated" loading={isLoading} empty={txSeries.length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <LineChart data={txSeries.map((p: TxPoint) => ({ date: p.date, value: p.count ?? 0 }))} />
        </ChartCard>

        <ChartCard title="Protocol Volume" subtitle="Daily" loading={isLoading} empty={volSeries.length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <BarChart data={volSeries.map((p: VolumePoint) => ({ date: p.date, value: p.volume ?? 0 }))} />
        </ChartCard>
      </div>
    </div>
  );
}
