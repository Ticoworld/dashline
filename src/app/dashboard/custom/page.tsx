"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ProjectCard from "@/components/cards/ProjectCard";
import { useToast } from "@/components/ui/ToastProvider";
import { useDashboardContext } from "@/context/DashboardContext";

export default function CustomDashboardsPage() {
	const router = useRouter();
	const ctx = useDashboardContext();
	const [page, setPage] = useState<number>(1);
	const limit = 12;
	const { data, isLoading } = api.project.list.useQuery({ page, limit });

	const utils = api.useContext();

	const restoreMutation = api.project.restore.useMutation({
		onSuccess() {
			utils.project.list.invalidate();
		},
	});

	const toast = useToast();

	const deleteMutation = api.project.delete.useMutation({
		// Optimistic update: remove the project from the paginated cache immediately
		async onMutate({ projectId }) {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await utils.project.list.cancel();
			// Snapshot previous value
			const previous = utils.project.list.getData({ page, limit });
			// Optimistically update cache
			utils.project.list.setData({ page, limit }, (old) => {
				if (!old) return old;
				return {
					...old,
					projects: old.projects.filter((p) => p.id !== projectId),
					total: Math.max(0, (old.total ?? old.projects.length) - 1),
				};
			});

						// show global toast with undo action (use confirmName if available)
						toast.showToast({
								message: confirmName ? `${confirmName} removed` : `Project removed`,
								severity: "info",
								actions: [
									{
										label: "Undo",
										onClick: async () => {
											await restoreMutation.mutateAsync({ projectId });
										},
									},
								],
						});
			return { previous };
		},
		onError(_err, _vars, context) {
			// Rollback to previous cache on error
			if (context?.previous) {
				utils.project.list.setData({ page, limit }, context.previous);
			}
		},
		onSettled() {
			// Invalidate to ensure data is fresh
			utils.project.list.invalidate();
			setConfirmId(null);
		},
	});

		const [confirmId, setConfirmId] = useState<string | null>(null);
		const [confirmName, setConfirmName] = useState<string | null>(null);

	function openProject(id: string) {
		try {
			ctx?.setProjectId(id);
			localStorage.setItem("dashline.projectId", id);
		} catch {}
		router.push(`/dashboard`);
	}

	if (isLoading) {
		return <div className="p-6">Loading...</div>;
	}

		const projects = data?.projects ?? [];
		const total = data?.total ?? projects.length;
		const totalPages = Math.max(1, Math.ceil(total / limit));

		if (projects.length === 0) {
		return (
			<div className="p-6">
				<EmptyState
					title="No dashboards yet"
					subtitle="Create your first dashboard by connecting a contract or wallet."
					primaryAction={{ label: "Create Dashboard", onClick: () => router.push("/dashboard/custom/new") }}
				/>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-xl font-semibold">Custom Dashboards</h2>
				<Link href="/dashboard/custom/new" className="px-3 py-2 rounded bg-[#6366F1] text-white text-sm">
					New
				</Link>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{projects.map((p) => (
		  <ProjectCard key={p.id} project={p} onOpen={openProject} onDelete={(id, name) => { setConfirmId(id); setConfirmName(name ?? null); }} />
		))}
	  </div>

			<div className="mt-6 flex items-center justify-between">
				<div className="text-sm text-gray-400">Page {page} of {totalPages}</div>
				<div className="flex items-center gap-2">
					<button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-[#111111] text-sm text-white">Prev</button>
					<button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded bg-[#111111] text-sm text-white">Next</button>
				</div>
			</div>

						<ConfirmModal
							open={Boolean(confirmId)}
							title="Confirm delete"
							description={confirmName ? `Are you sure you want to remove ${confirmName}? This will stop tracking the project.` : undefined}
							onClose={() => setConfirmId(null)}
							onConfirm={() => deleteMutation.mutate({ projectId: confirmId ?? "" })}
							isLoading={deleteMutation.status === "pending"}
						/>

						{/* toasts are rendered globally by ToastProvider */}
		</div>
	);
}

