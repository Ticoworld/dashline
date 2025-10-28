"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc";
import { useDashboardContext } from "@/context/DashboardContext";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default function NewCustomDashboardPage() {
	const router = useRouter();
	const ctx = useDashboardContext();
	const [contract, setContract] = useState("");
	const [chain, setChain] = useState("ethereum");
	const [error, setError] = useState<string | null>(null);
		const [helper, setHelper] = useState<string | null>(null);
		const [success, setSuccess] = useState<string | null>(null);

	const mutation = api.project.connect.useMutation();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!ADDRESS_REGEX.test(contract.trim())) {
			setError("Invalid contract address");
			return;
		}
		try {
			const res = await mutation.mutateAsync({ contractAddress: contract.trim(), chain });
				setSuccess(`Connected ${res.name ?? contract}`);
			// Persist selection and update context
			try {
				if (res.projectId) {
					ctx?.setProjectId(res.projectId);
					localStorage.setItem("dashline.projectId", res.projectId);
				}
			} catch {}
			router.push("/dashboard");
				} catch (err: unknown) {
					let msg = "Failed to connect project";
					if (err && typeof err === "object") {
						const maybe = err as { message?: unknown };
						if (typeof maybe.message === "string") msg = maybe.message;
						else msg = String(err);
					} else if (typeof err === "string") msg = err;
					setError(msg ?? "Failed to connect project");
				}
	}

	return (
		<div className="p-6 max-w-xl">
			<h2 className="text-xl font-semibold mb-4">Create a Dashboard</h2>
			<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm text-gray-300">Contract Address</label>
							<input value={contract} onChange={(e) => { setContract(e.target.value); setHelper(ADDRESS_REGEX.test(e.target.value) ? null : "Enter a valid EVM address (0x...)"); }} placeholder="0x..." className="w-full p-2 bg-[#0b0b0b] rounded" />
							{helper && <div className="text-xs text-yellow-400 mt-1">{helper}</div>}
						</div>

				<div>
					<label className="block text-sm text-gray-300">Chain</label>
					<select value={chain} onChange={(e) => setChain(e.target.value)} className="w-full p-2 bg-[#0b0b0b] rounded">
						<option value="ethereum">Ethereum</option>
						<option value="polygon">Polygon</option>
						<option value="base">Base</option>
					</select>
				</div>

			{error && <div className="text-sm text-red-400">{error}</div>}
			{success && <div className="text-sm text-green-400">{success}</div>}

								<div className="flex items-center gap-2">
									  <button disabled={mutation.status === "pending"} className="px-4 py-2 bg-[#6366F1] rounded text-white">{mutation.status === "pending" ? "Connecting..." : "Connect"}</button>
					<button type="button" onClick={() => router.push('/dashboard/custom')} className="px-3 py-2 rounded bg-[#111111] text-sm">Cancel</button>
				</div>
			</form>
		</div>
	);
}

