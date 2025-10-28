"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

type DashboardContextValue = {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
  syncTimeRange: boolean;
  setSyncTimeRange: (v: boolean) => void;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const ALLOWED: TimeRange[] = ["24h", "7d", "30d", "90d", "all"];

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [syncTimeRange, setSyncTimeRange] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashline.projectId");
      if (stored) setProjectId(stored);
      const storedRange = localStorage.getItem("dashline.timeRange");
      if (storedRange && ALLOWED.includes(storedRange as TimeRange)) setTimeRange(storedRange as TimeRange);
      const storedSync = localStorage.getItem("dashline.syncTimeRange");
      if (storedSync) setSyncTimeRange(storedSync === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (projectId) localStorage.setItem("dashline.projectId", projectId);
      else localStorage.removeItem("dashline.projectId");
      if (timeRange) localStorage.setItem("dashline.timeRange", timeRange);
      localStorage.setItem("dashline.syncTimeRange", String(syncTimeRange));
    } catch {}
  }, [projectId, timeRange, syncTimeRange]);

  return (
    <DashboardContext.Provider value={{ projectId, setProjectId, timeRange, setTimeRange, syncTimeRange, setSyncTimeRange }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  return ctx;
}

export default DashboardContext;
