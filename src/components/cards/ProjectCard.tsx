"use client";
import React from "react";

export default function ProjectCard({ project, onOpen, onDelete }: { project: { id: string; name: string; chain?: string; symbol?: string; logoUrl?: string | null }; onOpen: (id: string) => void; onDelete: (id: string, name?: string) => void; }) {
  const initials = (project.name || "").split(" ").map((p) => p[0]).join("");
  return (
    <div className="rounded border border-[#151515] p-4 bg-[#0A0A0A]">
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
