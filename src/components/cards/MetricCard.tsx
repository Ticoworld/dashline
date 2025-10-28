"use client";
// Claude P1: Improve metric visual hierarchy: larger value, tabular nums, delta badge, sparkline skeleton, last-updated
import React from "react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { Sparkline } from "./Sparkline";
import { ArrowUp, ArrowDown } from "lucide-react";

export type MetricPoint = { date: string; value: number };

export type MetricCardProps = {
  icon?: React.ReactNode;
  title: string;
  value?: number | string;
  format?: "number" | "currency" | "percentage";
  change?: number;
  changeType?: "increase" | "decrease";
  sparklineData?: MetricPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  lastUpdated?: string;
  comparisonLabel?: string; // e.g., "vs last 7d"
  changeFormat?: "number" | "currency" | "percentage";
};

export function MetricCard({
  icon,
  title,
  value,
  format = "number",
  change,
  changeType,
  changeFormat = "number",
  sparklineData,
  loading,
  error,
  onRetry,
  lastUpdated,
  comparisonLabel,
}: MetricCardProps): React.ReactElement {
  if (loading) {
    return (
      <div className="bg-[#111111] rounded-xl p-6 border border-[#151515]">
        <div className="h-6 w-40 bg-[#0A0A0A] rounded mb-3 animate-pulse" />
        <div className="h-12 w-48 bg-[#0A0A0A] rounded mb-3 animate-pulse" />
        <div className="h-8 w-full bg-[#0A0A0A] rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111111] rounded-xl p-6 border border-[#151515]">
        <div className="flex items-center justify-between">
          <div className="text-red-400">{error}</div>
          {onRetry && (
            <button onClick={onRetry} className="px-3 py-1 bg-white/6 rounded text-sm text-white focus:ring focus:ring-offset-2 focus:ring-[#6366F1]">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const formattedValue =
    value == null
      ? "—"
      : format === "currency"
      ? typeof value === "number"
        ? `$${value.toFixed(2)}`
        : String(value)
      : format === "percentage"
      ? typeof value === "number"
        ? `${value.toFixed(2)}%`
        : String(value)
      : typeof value === "number"
      ? formatNumber(value)
      : String(value);

  function formatChange(n?: number): string {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    if (changeFormat === "percentage") {
      const v = n.toFixed(2);
      return n > 0 ? `+${v}%` : `${v}%`;
    }
    if (changeFormat === "currency") {
      const formatted = formatCurrency(Math.abs(n));
      return n > 0 ? `+${formatted}` : `-${formatted}`;
    }
    // default: number
    const displayNum = Math.abs(n) >= 100 || Number.isInteger(n) ? Math.round(n).toString() : n.toFixed(2);
    return n > 0 ? `+${displayNum}` : `${displayNum}`;
  }

  return (
    <div className="bg-[#111111] rounded-xl p-6 border border-[#151515] hover:border-[#6366F1]/30 transition-all">
      <div className="flex flex-col">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {icon && <div className="text-[#6366F1] mt-1">{icon}</div>}
            <div>
              <div className="text-sm text-gray-300 tracking-wide">{title}</div>
              <div
                className="font-semibold text-white leading-tight tabular-nums"
                style={{ fontFeatureSettings: '"tnum" 1' }}
                aria-live="polite"
                aria-atomic="true"
                // fluid typography: ~30px to ~36px across breakpoints
                // Using clamp for smoother scaling
                
              >
                <span style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.25rem)" }}>{formattedValue}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            {typeof change === "number" && (
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm font-medium",
                  changeType === "increase" ? "bg-[rgba(16,185,129,0.08)] text-green-400" : "bg-[rgba(239,68,68,0.08)] text-red-400"
                )}
              >
            {changeType === "increase" ? <ArrowUp className="w-3 h-3 text-green-400" aria-hidden /> : <ArrowDown className="w-3 h-3 text-red-400" aria-hidden />}
            <span>{formatChange(change)}</span>
            <span className="sr-only">{changeType === 'increase' ? `Increased by ${change}` : `Decreased by ${change}`}</span>
              </div>
            )}
            {comparisonLabel && (
              <div className="mt-1 text-[10px] text-gray-500">{comparisonLabel}</div>
            )}
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4">
            <Sparkline data={sparklineData} />
          </div>
        )}

        <div className="mt-3 text-xs text-gray-400">Last updated: {lastUpdated ?? "—"}</div>
      </div>
    </div>
  );
}

export default MetricCard;
