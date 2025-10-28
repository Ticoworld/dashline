"use client";
import React, { useEffect } from "react";
import { useDashboardContext } from "@/context/DashboardContext";
import { api } from "@/lib/trpc";
import MetricCard from "@/components/cards/MetricCard";
import ChartCard from "@/components/cards/ChartCard";
import LineChart from "@/components/charts/LineChart";
import PieChart from "@/components/charts/PieChart";
import TableCard from "@/components/cards/TableCard";
import EmptyState from "@/components/ui/EmptyState";

export default function NFTPage() {
  const ctx = useDashboardContext();
  const projectId = ctx?.projectId ?? null;
  const timeRange = ctx?.timeRange ?? "7d";

  const { data, isLoading, isError, refetch } = api.metrics.getOverview.useQuery({ projectId: projectId ?? "", timeRange }, { enabled: !!projectId });

  useEffect(() => { if (projectId) refetch(); }, [projectId, refetch]);

  if (!projectId) return (
    <div className="p-6">
      <EmptyState title="No project selected" subtitle="Connect a collection to view NFT metrics." primaryAction={{ label: "Connect project", onClick: () => window.location.href = "/dashboard/connect" }} />
    </div>
  );

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-400">Failed to load NFT metrics</div>;

  // Simple mapping: price -> floor price, volume -> sales
  const floor = data?.price?.price ?? 0;
  const volume = data?.volume?.volume24h ?? 0;
  const holders = data?.holders?.totalHolders ?? 0;
  const holderSeries = data?.holders?.chartData ?? [];

  type HolderPoint = { date: string; holders?: number };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Floor Price" value={`$${floor.toFixed(2)}`} change={0} changeType="increase" onRetry={refetch} />
        <MetricCard title="24h Sales" value={`$${(volume / 1000).toFixed(1)}k`} change={0} changeType="decrease" onRetry={refetch} />
        <MetricCard title="Unique Holders" value={holders} change={0} changeType="increase" onRetry={refetch} />
        <MetricCard title="Active Traders" value={data?.transactions?.totalTx ?? 0} change={data?.transactions?.change ?? 0} changeType={(data?.transactions?.change ?? 0) > 0 ? "increase" : "decrease"} onRetry={refetch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Holder Growth" subtitle="Collectors over time" loading={isLoading} empty={(holderSeries as HolderPoint[]).length === 0} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <LineChart data={(holderSeries as HolderPoint[]).map((p) => ({ date: p.date, value: p.holders ?? 0 }))} />
        </ChartCard>

        <ChartCard title="Ownership Distribution" subtitle="Share of supply" loading={isLoading} empty={true} onRetry={refetch} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          <PieChart data={[]} />
        </ChartCard>
      </div>

      <div>
        <TableCard title="Recent Sales" columns={["Date", "Price", "Buyer"]} data={[]} loading={false} onRetry={refetch} />
      </div>
    </div>
  );
}
