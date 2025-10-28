"use client";
// Claude P1/P4: Skeleton improvements for charts and metrics
import React from "react";

export function Skeleton({ className = "h-6 w-full bg-[#0A0A0A] rounded animate-pulse" }: { className?: string }) {
  return <div className={className} />;
}

export default Skeleton;
