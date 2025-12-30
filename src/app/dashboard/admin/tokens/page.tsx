"use client";
import React from "react";

export default function TokensAdminPage() {
  const [addr, setAddr] = React.useState("");
  const [chain, setChain] = React.useState((process.env.NEXT_PUBLIC_DEFAULT_CHAIN || "ethereum"));
  const [fromBlock, setFromBlock] = React.useState("");
  const [adminKey, setAdminKey] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function call(path: string, body?: unknown) {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tokens/${addr}/admin/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({ chain, ...(body || {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setMsg("OK");
    } catch (e) {
      setMsg((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Tokens Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Contract Address</label>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x..." className="w-full rounded bg-[#0f0f0f] border border-[#1a1a1a] px-3 py-2 text-white" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Chain</label>
          <input value={chain} onChange={(e) => setChain(e.target.value)} placeholder="ethereum" className="w-full rounded bg-[#0f0f0f] border border-[#1a1a1a] px-3 py-2 text-white" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Admin Key (header x-admin-key)</label>
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="(dev optional)" className="w-full rounded bg-[#0f0f0f] border border-[#1a1a1a] px-3 py-2 text-white" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Reindex From Block</label>
          <input value={fromBlock} onChange={(e) => setFromBlock(e.target.value)} placeholder="12345678" className="w-full rounded bg-[#0f0f0f] border border-[#1a1a1a] px-3 py-2 text-white" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={loading} onClick={() => call("pause")} className="px-3 py-1 rounded bg-white/10 text-sm text-white disabled:opacity-50">Pause</button>
        <button disabled={loading} onClick={() => call("resume")} className="px-3 py-1 rounded bg-white/10 text-sm text-white disabled:opacity-50">Resume</button>
        <button disabled={loading} onClick={() => call("reindex", { fromBlock: Number(fromBlock) })} className="px-3 py-1 rounded bg-white/10 text-sm text-white disabled:opacity-50">Reindex from</button>
        <button disabled={loading} onClick={() => call("reset")} className="px-3 py-1 rounded bg-white/10 text-sm text-white disabled:opacity-50">Reset</button>
      </div>

      {msg && (
        <div className="text-sm {msg==='OK' ? 'text-green-400' : 'text-red-400'}">
          {msg}
        </div>
      )}

      <div className="text-xs text-gray-400">Use carefully. In production, protect this screen behind proper admin auth/roles.</div>
    </div>
  );
}
