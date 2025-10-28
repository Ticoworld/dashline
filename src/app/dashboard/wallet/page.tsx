"use client";
import React, { useEffect, useState } from "react";
import { useDashboardContext } from "@/context/DashboardContext";
import { api } from "@/lib/trpc";
import ChartCard from "@/components/cards/ChartCard";
import LineChart from "@/components/charts/LineChart";
import MetricCard from "@/components/cards/MetricCard";
import EmptyState from "@/components/ui/EmptyState";
import TableCard from "@/components/cards/TableCard";

export default function WalletPage() {
  const ctx = useDashboardContext();
  const projectId = ctx?.projectId ?? null;
  const timeRange = ctx?.timeRange ?? "7d";
  const [address, setAddress] = useState("");

  const { data, isLoading, refetch } = api.wallet.getOverview.useQuery({ address: address || projectId || "", timeRange }, { enabled: false });

  const projectQuery = api.project.get.useQuery({ projectId: projectId ?? "" }, { enabled: !!projectId });
  const contractAddress = projectQuery.data?.project?.contractAddress ?? undefined;

  const balancesQuery = api.wallet.getTokenBalances.useQuery({ contractAddress, walletAddress: address || "" }, { enabled: Boolean(contractAddress && (address || projectId)) });

  useEffect(() => {
    if (address) refetch();
  }, [address, refetch]);

  if (!address && !projectId) {
    return (
      <div className="p-6">
        <EmptyState title="No wallet selected" subtitle="Enter a wallet address to start tracking activity." primaryAction={{ label: "Enter address", onClick: () => {} }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-xl">
        <label className="block text-sm text-gray-300">Wallet address (optional)</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." className="w-full p-2 bg-[#0b0b0b] rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Active Wallets" value={data?.totalTx ?? 0} change={data?.change ?? 0} changeType={(data?.change ?? 0) > 0 ? "increase" : "decrease"} onRetry={() => refetch()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Tx Count" subtitle="Txs over time" loading={isLoading} empty={!data?.chartData || data?.chartData.length === 0} onRetry={() => refetch()} timeRange={timeRange} onRangeChange={(r) => ctx?.setTimeRange(r)}>
          {(() => {
            type Point = { date: string; value: number };
            const pts: Point[] = (data?.chartData ?? []).map((p: unknown) => {
              const item = p as { date?: string; value?: number };
              return { date: item.date ?? "", value: item.value ?? 0 };
            });
            return <LineChart data={pts} />;
          })()}
        </ChartCard>
      </div>

      <div className="mt-6">
        <TableCard title="Token Balances" columns={["contractAddress", "balance"]} data={(balancesQuery.data?.balances ?? []).map((b) => ({ contractAddress: b.contractAddress, balance: b.balance }))} loading={balancesQuery.isLoading} onRetry={() => balancesQuery.refetch()} />
      </div>
    </div>
  );
}
