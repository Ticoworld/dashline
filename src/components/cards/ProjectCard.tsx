"use client";
import React from "react";

type StatusPayload = { found?: boolean; status?: string; lastBlockScanned?: number; lastUpdated?: string; recentReady?: boolean; progressPct?: number };

export default function ProjectCard({ project, onOpen, onDelete }: { project: { id: string; name: string; chain?: string; symbol?: string; logoUrl?: string | null }; onOpen: (id: string) => void; onDelete: (id: string, name?: string) => void; }) {
  const initials = (project.name || "").split(" ").map((p) => p[0]).join("");
  const [status, setStatus] = React.useState<null | StatusPayload>(null);

  React.useEffect(() => {
    let mounted = true;
    const pollMs = Number(process.env.NEXT_PUBLIC_TOKEN_STATUS_POLL_MS ?? 15000);
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/tokens/status?projectId=${encodeURIComponent(project.id)}`);
        if (!mounted) return;
        if (res.ok) {
          setStatus(await res.json());
        } else if (res.status === 404) {
          setStatus({ found: false });
        }
      } catch {
        /* ignore */
      }
    }
    fetchStatus();
    const iv = setInterval(fetchStatus, pollMs);
    return () => { mounted = false; clearInterval(iv); };
  }, [project.id]);
  const showIndexing = Boolean(status && status.found && status.status && status.status !== 'complete');
  const pct = Math.max(0, Math.min(100, Number(status?.progressPct ?? 0)));
  return (
    <div className="rounded border border-[#151515] p-4 bg-[#0A0A0A]">
      {showIndexing && (
        <div className="mb-2 -mt-1 rounded border border-yellow-800 bg-yellow-900/30 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-yellow-300">
            <span>Indexing</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded bg-yellow-950/60">
            <div className="h-1.5 rounded bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {project.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.logoUrl} alt={`${project.name} logo`} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-sm font-semibold text-white">{initials}</div>
          )}
          <div>
            <div className="font-semibold text-white">{project.name}</div>
            <div className="text-xs text-gray-400">{project.chain} • {project.symbol}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onOpen(project.id)} className="px-2 py-1 rounded bg-[#111111] text-sm text-white">Open</button>
          <button onClick={() => onDelete(project.id, project.name)} className="px-2 py-1 rounded bg-[#2a2a2a] text-sm text-red-400">Delete</button>
        </div>
      </div>
    </div>
  );
}
