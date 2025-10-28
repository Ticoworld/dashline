"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { formatDecimalBalance } from "@/lib/formatters";
import Tooltip from "@/components/ui/Tooltip";

// Local JsonValue-compatible types (kept local to avoid cross-file imports)
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | { [k: string]: JsonValue } | JsonValue[];

type SortDirection = "asc" | "desc";

const ROW_HEIGHT = 48;
const OVERSCAN = 6;
const VIRTUALIZATION_THRESHOLD = 50;

export function TableCard<T extends Record<string, JsonValue>>({
  title,
  columns,
  data,
  loading,
  error,
  onRetry,
  showHeader = true,
  disableInnerScroll = false,
  resetKey,
}: {
  title: string;
  columns: Array<keyof T & string>;
  data: T[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // When embedded inside another card (e.g., ChartCard), hide local header to avoid duplication
  showHeader?: boolean;
  // When true the table will not apply an internal max-height and will expand to fit its rows.
  disableInnerScroll?: boolean;
  // Optional key used to force-reset internal scroll (e.g., page changes)
  resetKey?: string | number;
}) {
  const [sortState, setSortState] = useState<{ column: keyof T & string; direction: SortDirection } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const sortedData = useMemo(() => {
    if (!sortState) return data;
    const { column, direction } = sortState;
    const modifier = direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      const left = a[column];
      const right = b[column];

      if (left == null && right == null) return 0;
      if (left == null) return -1 * modifier;
      if (right == null) return 1 * modifier;

      if (typeof left === "number" && typeof right === "number") {
        return left === right ? 0 : left > right ? modifier : -modifier;
      }

      const aValue = typeof left === "object" ? JSON.stringify(left) : String(left);
      const bValue = typeof right === "object" ? JSON.stringify(right) : String(right);
      return aValue.localeCompare(bValue, undefined, { sensitivity: "base", numeric: true }) * modifier;
    });
  }, [data, sortState]);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    // Observe container size to compute viewport height for virtualization
    const handleResize = () => {
      const h = node.clientHeight || 0;
      setViewportHeight(h);
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  useEffect(() => {
    // Reset scroll when the dataset changes substantially.
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [sortedData.length]);

  // Also reset when an external reset key changes (pagination or page switches)
  useEffect(() => {
    if (typeof resetKey !== 'undefined' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [resetKey]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const shouldVirtualize = sortedData.length > VIRTUALIZATION_THRESHOLD;
  const effectiveRowHeight = ROW_HEIGHT;
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / effectiveRowHeight)) : 0;
  const visibleCount = shouldVirtualize ? Math.ceil((viewportHeight || 0) / effectiveRowHeight) + OVERSCAN : sortedData.length;
  const endIndex = shouldVirtualize ? Math.min(sortedData.length, startIndex + visibleCount) : sortedData.length;
  const topSpacerHeight = shouldVirtualize ? startIndex * effectiveRowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize ? Math.max(0, sortedData.length * effectiveRowHeight - topSpacerHeight - (endIndex - startIndex) * effectiveRowHeight) : 0;
  const visibleRows = shouldVirtualize ? sortedData.slice(startIndex, endIndex) : sortedData;
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const handleSort = useCallback(
    (column: keyof T & string) => {
      setSortState((prev) => {
        if (!prev || prev.column !== column) {
          return { column, direction: "asc" };
        }
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      });
    },
    []
  );

  function getAriaSort(column: keyof T & string): "ascending" | "descending" | "none" {
    if (!sortState || sortState.column !== column) return "none";
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  const onKeyDownTable = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = rowRefs.current.findIndex((el) => el === (document.activeElement as HTMLElement));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(rowRefs.current.length - 1, index + 1);
      rowRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      rowRefs.current[prev]?.focus();
    }
  }, []);

  return (
    <div className="bg-[#111111] rounded-xl p-6 border border-[#151515] overflow-auto">
      {showHeader && (
        <div className="px-6 py-4 border-b border-[#151515]">
          <div className="text-base font-medium text-white" aria-live="polite">
            {title}
          </div>
        </div>
      )}
      <div
        ref={scrollContainerRef}
        className={disableInnerScroll ? "w-full" : "w-full overflow-auto"}
        style={disableInnerScroll ? undefined : { maxHeight: 420 }}
        onScroll={disableInnerScroll ? undefined : handleScroll}
        onKeyDown={onKeyDownTable}
      >
        {/* Right fade to hint horizontal scroll */}
        <div aria-hidden className="pointer-events-none sticky right-0 top-0 float-right h-0 w-0">
          {/* Container for positioning */}
        </div>
        <div aria-hidden className="pointer-events-none sticky -right-px top-0 h-10 w-8 bg-gradient-to-l from-[#111111] to-transparent ml-auto" />
        {/* Left fade to hint horizontal scroll */}
        <div aria-hidden className="pointer-events-none sticky -left-px top-0 h-10 w-8 bg-gradient-to-r from-[#111111] to-transparent" />
        <table className="min-w-full table-auto" aria-label={title}>
          <caption className="sr-only">{title}</caption>
          <thead className="sticky top-0 bg-[#1A1A1A]">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c)}
                  scope="col"
                  aria-sort={getAriaSort(c)}
                  className="px-4 py-3 text-left text-sm text-gray-200 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(c)}
                    className="group flex w-full items-center gap-2 text-left text-gray-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                  >
                    <Tooltip content={String(c)}>
                      <span className="flex-1 truncate" title={String(c)}>{String(c)}</span>
                    </Tooltip>
                    <ArrowUpDown
                      className={`h-3 w-3 transition-opacity ${sortState?.column === c ? "opacity-100 text-[#6366F1]" : "opacity-40 group-hover:opacity-100 text-gray-400"}`}
                      aria-hidden
                    />
                    {sortState?.column === c && (
                      <span className="sr-only">Sorted {sortState.direction === 'asc' ? 'ascending' : 'descending'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading data…
                  </div>
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-red-400">
                  <div className="flex items-center justify-between">
                    <div>{error}</div>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="px-3 py-1 rounded bg-white/10 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <span>No data</span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="px-3 py-1 rounded bg-white/10 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && shouldVirtualize && topSpacerHeight > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: topSpacerHeight }} />
              </tr>
            )}

            {!loading && !error && visibleRows.map((row, idx) => {
              const rowIndex = shouldVirtualize ? startIndex + idx : idx;
              return (
                <tr
                  key={rowIndex}
                  ref={(el) => { rowRefs.current[rowIndex] = el; }}
                  tabIndex={0}
                  className={`${rowIndex % 2 === 0 ? "bg-transparent" : "bg-[#0f0f0f]"} hover:bg-[#151515]/60 focus:bg-[#151515]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]`}
                >
                  {columns.map((c) => {
                    const cell = row[c];
                    let text = cell === undefined || cell === null ? "-" : typeof cell === "object" ? JSON.stringify(cell) : String(cell);
                    if (String(c).toLowerCase().includes("balance")) {
                      text = formatDecimalBalance(text);
                    }
                    return (
                      <td key={String(c)} className="px-4 py-3 text-sm text-white whitespace-nowrap">
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {!loading && !error && shouldVirtualize && bottomSpacerHeight > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: bottomSpacerHeight }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TableCard;
