"use client";
// Claude P2: Adjust TopBar spacing and overall layout to account for 60px TopBar and softer dark background
import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MainCanvas } from "@/components/layout/MainCanvas";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:inline-block focus-ring m-2 rounded">
        Skip to main content
      </a>
      <TopBar onSidebarToggle={() => setSidebarOpen((prev) => !prev)} isSidebarOpen={sidebarOpen} />
      {/* TopBar height is 60px, so add equivalent padding-top */}
      <div className="pt-[60px] flex">
        <Sidebar open={sidebarOpen} onOpenChange={(nextOpen) => setSidebarOpen(nextOpen)} />
        <MainCanvas>
          <ErrorBoundary>
            <div id="main-content">{children}</div>
          </ErrorBoundary>
        </MainCanvas>
      </div>
    </div>
  );
}

export default DashboardLayout;
