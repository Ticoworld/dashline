"use client";
import React from "react";

type Counters = Record<string, number>;

export default function ProvidersAdminPage() {
  const [metrics, setMetrics] = React.useState<Counters>({});
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/metrics", { cache: "no-store" });
      const data = await res.json();
      setMetrics((data?.metrics ?? {}) as Counters);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const entries = Object.entries(metrics)
    .filter(([k]) => k.startsWith("providers."))
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Provider Telemetry</h1>
        <button onClick={load} className="px-3 py-1 rounded bg-white/10 text-sm text-white">Refresh</button>
      </div>

      {loading && <div className="text-gray-300">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}

      {!loading && !error && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <table className="min-w-full table-auto">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-gray-300">Metric</th>
                <th className="px-4 py-2 text-right text-sm text-gray-300">Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td className="px-4 py-3 text-gray-400" colSpan={2}>No provider metrics recorded yet.</td></tr>
              )}
              {entries.map(([k, v]) => (
                <tr key={k} className="odd:bg-[#0f0f0f]">
                  <td className="px-4 py-2 text-sm text-white">{k}</td>
                  <td className="px-4 py-2 text-sm text-white text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400">This view is basic and for operational debugging. In production, protect this route behind admin auth.</div>
    </div>
  );
}
