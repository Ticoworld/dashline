"use client";
import { api } from "@/lib/trpc";
import { useCallback, useEffect } from "react";

type Project = { id: string; name: string; contractAddress?: string };

export function useProjectSelector(onChange?: (id: string | null) => void) {
  const { data, refetch } = api.project.list.useQuery(undefined, {
    staleTime: 0,
  });

  const select = useCallback((id?: string | null) => {
    if (!id) {
      try {
        localStorage.removeItem("dashline.projectId");
      } catch {}
      onChange?.(null);
      return;
    }
    try {
      localStorage.setItem("dashline.projectId", id);
    } catch {}
    onChange?.(id);
  }, [onChange]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-select first project if none is chosen
  useEffect(() => {
    const projects = (data?.projects ?? []) as Project[];
    if (projects.length > 0) {
      try {
        const current = localStorage.getItem("dashline.projectId");
        if (!current) select(projects[0].id);
      } catch {}
    }
  }, [data, select]);

  return { projects: (data?.projects ?? []) as Project[], select, refetch };
}

export default useProjectSelector;
