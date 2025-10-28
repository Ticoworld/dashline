"use client";
import { useEffect, useState } from "react";

export function useDashboard() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h'|'7d'|'30d'|'90d'|'all'>('7d');

  useEffect(() => {
    const stored = localStorage.getItem('dashline.projectId');
    if (stored) setProjectId(stored);
  }, []);

  useEffect(() => {
    if (projectId) localStorage.setItem('dashline.projectId', projectId);
  }, [projectId]);

  return { projectId, setProjectId, timeRange, setTimeRange };
}

export default useDashboard;
