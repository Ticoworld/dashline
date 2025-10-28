"use client";
import React from "react";
import { Download } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Tooltip from "@/components/ui/Tooltip";

type TimeRangeOption = "24h" | "7d" | "30d" | "90d" | "all";

const relativeTimeFormatter = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

function formatLastUpdated(value?: Date | string | number): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (relativeTimeFormatter) {
    const segments: Array<{ limit: number; unit: Intl.RelativeTimeFormatUnit; divisor: number }> = [
      { limit: 60, unit: "second", divisor: 1 },
      { limit: 3600, unit: "minute", divisor: 60 },
      { limit: 86400, unit: "hour", divisor: 3600 },
      { limit: 604800, unit: "day", divisor: 86400 },
      { limit: 2629800, unit: "week", divisor: 604800 },
      { limit: 31557600, unit: "month", divisor: 2629800 },
    ];

    for (const { limit, unit, divisor } of segments) {
      if (Math.abs(diffSeconds) < limit) {
        const delta = Math.trunc(diffSeconds / divisor) || 1;
        return relativeTimeFormatter.format(-delta, unit);
      }
    }

    const years = Math.trunc(diffSeconds / 31557600) || 1;
    return relativeTimeFormatter.format(-years, "year");
  }

  const minutes = Math.max(1, Math.round(diffSeconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export function ChartCard({
  title,
  subtitle,
  exportable,
  children,
  loading,
  error,
  empty,
  onRetry,
  timeRange,
  onRangeChange,
  availableRanges = ["24h", "7d", "30d", "90d", "all"],
  lastUpdatedAt,
  dataSource,
  synthetic,
}: {
  title: string;
  subtitle?: string;
  exportable?: boolean;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  onRetry?: () => void;
  timeRange?: TimeRangeOption;
  onRangeChange?: (range: TimeRangeOption) => void;
  availableRanges?: TimeRangeOption[];
  lastUpdatedAt?: Date | string | number;
  dataSource?: string | null;
  synthetic?: boolean;
}): React.ReactElement {
  const [showSkeleton, setShowSkeleton] = React.useState(false);
  const [relativeUpdatedLabel, setRelativeUpdatedLabel] = React.useState(() => formatLastUpdated(lastUpdatedAt));
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (loading) {
      const timeout = window.setTimeout(() => setShowSkeleton(true), 120);
      return () => window.clearTimeout(timeout);
    }
    setShowSkeleton(false);
  }, [loading]);

  React.useEffect(() => {
    setRelativeUpdatedLabel(formatLastUpdated(lastUpdatedAt));
    if (!lastUpdatedAt || typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setRelativeUpdatedLabel(formatLastUpdated(lastUpdatedAt));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [lastUpdatedAt]);

  const normalizedSource = dataSource?.trim() ? dataSource : null;

  return (
    <div className="bg-[#111111] rounded-xl p-6 border border-[#151515] flex flex-col h-full">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-0.5">
          <div className="text-base font-medium text-white">{title}</div>
          {subtitle && <div className="text-sm text-gray-300">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {onRangeChange && (
            <div className="flex items-center gap-1 rounded-md bg-[#0F0F0F] p-1" role="group" aria-label="Select chart time range">
              {availableRanges.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => onRangeChange(range)}
                  aria-pressed={timeRange === range}
                  disabled={loading}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    timeRange === range
                      ? "bg-[#6366F1] text-white shadow"
                      : "text-gray-200 hover:text-white"
                  } ${loading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {range}
                </button>
              ))}
            </div>
          )}
          {exportable && (
            <button
              type="button"
              aria-label="Export chart as PNG/CSV"
              disabled={exporting}
              onClick={async () => {
                try {
                  setExporting(true);
                  // Placeholder export behavior; integrate with actual export later
                  await new Promise((r) => setTimeout(r, 600));
                } finally {
                  setExporting(false);
                }
              }}
              className="flex items-center gap-2 rounded border border-[#1A1A1A] px-3 py-1 text-sm text-gray-200 hover:bg-[#0A0A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <Download className="w-4 h-4 text-gray-200" />
              )}
              <span>{exporting ? "Exporting" : "Export"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1">
        {loading && showSkeleton ? (
          <Skeleton className="h-full min-h-[240px] w-full" />
        ) : error ? (
          <div className="p-6">
            <div className="text-red-400">{error}</div>
            {onRetry && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1 rounded bg-white/10 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : empty ? (
          <div className="h-full min-h-[240px] flex items-center justify-center">
            <EmptyState title="No data" subtitle="There's no data to show for this range." />
            {onRetry && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1 rounded bg-white/10 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 h-full min-h-[240px] flex items-stretch">
            <div className="w-full">{children}</div>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-300 flex flex-wrap items-center gap-2">
        <span>
          Data source: <span className="text-white font-medium">{normalizedSource ?? "—"}</span>
        </span>
        <span className="text-gray-600" aria-hidden>{"•"}</span>
        <span>
          Last updated: {lastUpdatedAt ? (
            <Tooltip content={new Date(lastUpdatedAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC"}>
              <span className="underline cursor-help">{relativeUpdatedLabel}</span>
            </Tooltip>
          ) : (
            relativeUpdatedLabel
          )}
        </span>
        {synthetic && (
          <>
            <span className="text-gray-600" aria-hidden>{"•"}</span>
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-orange-500/15 text-orange-300 border border-orange-500/30"
              title="This data is synthetic or incomplete due to provider limits."
            >
              Synthetic Data
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default ChartCard;
