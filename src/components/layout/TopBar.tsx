"use client";
// Claude P2/P3: Increase TopBar height, accessible project selector placeholder, aria-pressed time toggles
import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Bell, ChevronDown, HelpCircle, Menu } from "lucide-react";
import useProjectSelector from "@/hooks/useProjectSelector";
import { useDashboardContext } from "@/context/DashboardContext";
import * as RadixSelect from "@radix-ui/react-select";
import { api } from "@/lib/trpc";
import Tooltip from "@/components/ui/Tooltip";
import { UserButton, useUser } from "@clerk/nextjs";
import Logo from "@/components/ui/Logo";
import { usePathname, useRouter } from "next/navigation";
import Toggle from "@/components/ui/Toggle";

type TopBarProps = {
  onProjectChange?: (id: string | null) => void;
  onSidebarToggle?: () => void;
  isSidebarOpen?: boolean;
};

export function TopBar({ onProjectChange, onSidebarToggle, isSidebarOpen }: TopBarProps): React.ReactElement {
  const ctx = useDashboardContext();
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  const { projects, select } = useProjectSelector(onProjectChange);
  const [query, setQuery] = useState<string>("");
  const enableProjectSearch = process.env.NEXT_PUBLIC_ENABLE_PROJECT_SEARCH !== 'false';
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Load last seen notifications timestamp from localStorage
  useEffect(() => {
    try {
      const ts = localStorage.getItem("dashline.notifications.lastSeen");
      if (ts) setLastSeen(ts);
    } catch {}
  }, []);

  const notificationsQuery = api.notifications.getUnreadCount.useQuery(
    { since: lastSeen ?? undefined },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  const unreadCount = notificationsQuery.data?.count ?? 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    const matches = projects.filter((p) => p.name.toLowerCase().includes(q) || (p.contractAddress ?? "").toLowerCase().includes(q));
    // Always include the selected project even if it doesn't match search
    const sel = ctx?.projectId;
    if (sel && !matches.find((p) => p.id === sel)) {
      const selectedProj = projects.find((p) => p.id === sel);
      if (selectedProj) return [selectedProj, ...matches];
    }
    return matches;
  }, [projects, query, ctx?.projectId]);

  // Keep selected in sync with DashboardContext (single source of truth)
  const selected = ctx?.projectId ?? "";
  const activeProject = useMemo(() => projects.find((p) => p.id === selected), [projects, selected]);

  function handleSelect(id?: string) {
    // Clear search on selection so next open is clean
    setQuery("");
    // Use the hook to manage localStorage and notify callbacks
    select(id ?? null);
    onProjectChange?.(id ?? null);
    if (ctx) ctx.setProjectId(id ?? null);
    // After selecting on the connect page, take user to the dashboard
    if (pathname?.startsWith("/dashboard/connect")) {
      router.push("/dashboard");
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-[60px] items-center gap-2 sm:gap-3 border-b border-[#151515] bg-[#0A0A0A] px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {onSidebarToggle && (
          <button
            type="button"
            aria-label={isSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isSidebarOpen}
            aria-controls="dashline-mobile-nav"
            onClick={onSidebarToggle}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors md:hidden ${
              isSidebarOpen
                ? 'border-[#6366F1] bg-[#6366F1]/10 text-white'
                : 'border-[#1A1A1A] bg-[#111111] text-gray-200 hover:bg-[#151515]'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]`}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Brand (desktop only) */}
        <Link href="/dashboard" className="hidden md:flex items-center font-semibold text-white hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]" aria-label="Dashline home">
          <Logo label="Dashline" />
        </Link>
        <div className="relative">
          <label className="sr-only" htmlFor="project-select">
            Select project
          </label>
          {/* Compact project selector per header audit */}
          {/* Project selector visible only on md+ (moved to mobile sidebar) */}
          <div className="hidden md:block">
            <RadixSelect.Root 
              value={selected} 
              onValueChange={(v) => handleSelect(v || undefined)}
              onOpenChange={(open) => {
                // Clear search when dropdown closes
                if (!open) setQuery("");
              }}
            >              <RadixSelect.Trigger
                id="project-select"
                className="flex min-w-[140px] max-w-[200px] items-center gap-2 truncate rounded-md px-2 py-1 text-sm font-medium text-white hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] md:min-w-[180px] md:max-w-[260px]"
                title={activeProject?.name}
                aria-label="Select project"
              >
                <Tooltip content={activeProject?.name ?? "Select project"}>
                  <span className="flex-1 truncate text-left">
                    <RadixSelect.Value placeholder="Select project" />
                  </span>
                </Tooltip>
                <RadixSelect.Icon>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </RadixSelect.Icon>
              </RadixSelect.Trigger>

              <RadixSelect.Portal>
                <RadixSelect.Content
                  position="popper"
                  sideOffset={6}
                  className="relative z-[90] mt-2 min-w-[220px] rounded-md border border-[#222] bg-[#0A0A0A] shadow-2xl ring-1 ring-[#111]"
                >
                  {enableProjectSearch && (
                    <div className="p-2">
                      <input
                        aria-label="Search projects"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search projects or contract"
                        className="w-full rounded border border-[#222] bg-[#0A0A0A] px-2 py-1 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#6366F1]"
                      />
                    </div>
                  )}
                  <RadixSelect.Viewport className="max-h-[50vh] overflow-auto">
                    {filtered.length === 0 ? (
                      <div className="p-3 text-sm text-gray-400">No projects match your search</div>
                    ) : (
                      filtered.map((p) => (
                        <RadixSelect.Item
                          key={p.id}
                          value={p.id}
                          className="flex items-center gap-2 cursor-pointer px-3 py-2 text-sm text-white outline-none min-h-[40px] rounded-md hover:bg-[#111111] focus:bg-[#111111] data-[state=checked]:bg-[#111111] data-[state=checked]:text-white focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                        >
                          <RadixSelect.ItemText>{p.name}</RadixSelect.ItemText>
                        </RadixSelect.Item>
                      ))
                    )}
                  </RadixSelect.Viewport>
                </RadixSelect.Content>
              </RadixSelect.Portal>
            </RadixSelect.Root>
          </div>
        </div>
      </div>

      {/* Center context: show on desktop; provide compact context on mobile */}
      <div className="hidden flex-1 items-center justify-center md:flex">
        {activeProject ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Viewing</span>
            <span className="font-semibold text-white">{activeProject.name}</span>
            {ctx?.timeRange && <span className="text-xs text-gray-500">· {ctx.timeRange.toUpperCase()} range</span>}
                <span className="ml-3">
                  <Toggle checked={!!ctx?.syncTimeRange} onChange={(v) => ctx?.setSyncTimeRange(v)} label="Sync ranges" />
                </span>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Select a project to populate your dashboard</div>
        )}
      </div>
      {/* Mobile truncated project context removed to reduce TopBar crowding */}

  <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Help link (desktop only) */}
        <Tooltip content="Help & Documentation">
          <Link
            href="/dashboard/help"
            className="hidden md:flex items-center justify-center h-9 w-9 rounded-full text-gray-300 hover:text-white hover:bg-[#151515] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
            aria-label="Help and documentation"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </Tooltip>
        <Link
          href="/dashboard/connect"
          className="hidden md:inline-flex items-center gap-2 rounded-md bg-[#6366F1] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5558E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          Connect Wallet/Contract
        </Link>
        <Link
          href="/dashboard/connect"
          aria-label="Connect wallet or contract"
          className="md:hidden rounded-md border border-[#1A1A1A] p-2 text-gray-300 transition-colors hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <span className="text-xs font-medium">Connect</span>
        </Link>
        <Tooltip content={unreadCount > 0 ? `${unreadCount} unread` : "No new notifications"}>
          <button
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : `Notifications, no new notifications`}
            aria-live="polite"
            className="relative rounded-full p-2 text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => {
              // Mark as read by setting lastSeen to now
              const now = new Date().toISOString();
              try {
                localStorage.setItem("dashline.notifications.lastSeen", now);
              } catch {}
              setLastSeen(now);
            }}
            disabled={notificationsQuery.isLoading}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span aria-hidden className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <span className="sr-only">View notifications</span>
          </button>
        </Tooltip>
        <div className="relative">
          {/* Use Clerk's ready-made account dropdown */}
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonPopoverCard: "bg-[#0A0A0A] border border-[#151515]" } }} />
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md border border-[#1A1A1A] px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
