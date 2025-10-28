"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc";
import { useToast } from "@/components/ui/ToastProvider";
import Link from "next/link";
import { useDashboardContext } from "@/context/DashboardContext";

export default function ConnectPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [contract, setContract] = useState("");
  const [chain, setChain] = useState("ethereum");
  const mutation = api.project.connect.useMutation();
  const projectsQuery = api.project.list.useQuery(undefined, { staleTime: 60_000 });
  const ctx = useDashboardContext();

  const isValidAddress = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(contract.trim()), [contract]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await mutation.mutateAsync({ contractAddress: contract.trim(), chain });
      // Auto-select the newly created project so dashboard opens to it
      try {
        localStorage.setItem("dashline.projectId", res.projectId);
      } catch {}
      if (ctx) ctx.setProjectId(res.projectId);
      // Ensure project list is refreshed in UI
      try {
        projectsQuery.refetch();
      } catch {}

      showToast({ severity: "success", message: "Project connected and selected. Redirecting to dashboard…", duration: 1800 });
      // Small delay so users see confirmation, then navigate
      setTimeout(() => router.push("/dashboard"), 400);
      console.log("connected", res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect project";
      showToast({ severity: "error", message: msg });
      console.error(err);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Connect a Project</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md" aria-busy={mutation.isPending}>
        <div>
          <label className="block text-sm text-gray-300">Contract Address</label>
          <input
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            className="w-full p-2 bg-[#0b0b0b] rounded"
            placeholder="0x…"
            disabled={mutation.isPending}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300">Chain</label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="w-full p-2 bg-[#0b0b0b] rounded"
            disabled={mutation.isPending}
          >
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
            <option value="base">Base</option>
          </select>
        </div>
        <button
          className="px-4 py-2 bg-[#6366F1] rounded text-white disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          disabled={!isValidAddress || mutation.isPending}
        >
          {mutation.isPending && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
          )}
          Connect
        </button>
      </form>
      <div className="mt-10 max-w-2xl">
        <h3 className="text-lg font-semibold mb-3">Your connected projects</h3>
        {projectsQuery.isLoading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : ((projectsQuery.data?.projects?.length ?? 0) === 0) ? (
          <div className="text-sm text-gray-400">No projects yet. Connect a contract to get started.</div>
        ) : (
          <ul className="divide-y divide-[#151515] rounded-md border border-[#151515] bg-[#0F0F0F]">
            {(projectsQuery.data?.projects ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{p.name}</div>
                  {p.contractAddress && <div className="truncate text-xs text-gray-500">{p.contractAddress}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/dashboard" className="text-xs rounded bg-[#6366F1] px-2 py-1 text-white hover:bg-[#5558E3]">Open</Link>
                  <Link href={`/dashboard/settings?project=${p.id}`} className="text-xs rounded border border-[#1A1A1A] px-2 py-1 text-gray-200 hover:bg-[#151515]">Manage</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
