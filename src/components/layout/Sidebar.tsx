"use client";
// Claude P2: Sidebar spacing, accessibility, and active accent strip
import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Grid2x2,
  Wallet,
  FileCode,
  LineChart,
  Sparkles,
  HelpCircle,
  Settings,
  Plus,
  X,
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import useProjectSelector from "@/hooks/useProjectSelector";
import { useDashboardContext } from "@/context/DashboardContext";
import { UserButton, useUser } from "@clerk/nextjs";
// Logo not used in Sidebar

type NavItem = { href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

const navSections: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Dashboards",
    items: [
      { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/custom", label: "Custom Dashboards", icon: Grid2x2 },
    ],
  },
  {
    heading: "Web3 Insights",
    items: [
      { href: "/dashboard/wallet", label: "Wallet Tracking", icon: Wallet },
      { href: "/dashboard/contracts", label: "Contract Analysis", icon: FileCode },
      { href: "/dashboard/defi", label: "DeFi Insights", icon: LineChart },
      { href: "/dashboard/nft", label: "NFT Insights", icon: Sparkles },
    ],
  },
  {
    heading: "Resources",
    items: [{ href: "/dashboard/help", label: "Help & Docs", icon: HelpCircle }],
  },
  {
    heading: "Settings",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

type SidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function Sidebar({ open, onOpenChange }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const ctx = useDashboardContext();
  const { projects, select } = useProjectSelector();
  const { isSignedIn, user } = useUser();
  const [mobileQuery, setMobileQuery] = React.useState<string>("");
  const [mobileModalOpen, setMobileModalOpen] = React.useState(false);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  const selected = ctx?.projectId ?? "";
  const filteredMobile = React.useMemo(() => {
    const q = mobileQuery.trim().toLowerCase();
    if (!q) return projects;
    const matches = projects.filter((p) => p.name.toLowerCase().includes(q) || (p.contractAddress ?? "").toLowerCase().includes(q));
    // Always include selected project
    if (selected && !matches.find((p) => p.id === selected)) {
      const selectedProj = projects.find((p) => p.id === selected);
      if (selectedProj) return [selectedProj, ...matches];
    }
    return matches;
  }, [projects, mobileQuery, selected]);

  // Focus management for mobile menu: when opened, focus the first link; close on Escape
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      // focus first link if present
      setTimeout(() => firstLinkRef?.current?.focus(), 50);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Focus and escape handling for mobile project modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileModalOpen(false);
    }
    if (mobileModalOpen) {
      document.addEventListener("keydown", onKey);
      setTimeout(() => mobileSearchRef?.current?.focus(), 50);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileModalOpen]);

  return (
    <>
      {/* Desktop sidebar fixed with wider width and softer bg */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className="fixed left-0 top-0 hidden h-screen w-72 flex-col border-r border-[#151515] bg-[#0A0A0A] md:flex"
      >
        <div className="p-6">
          <Link href="/dashboard" className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]">
            {/* <Logo label="Dashline" /> */}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="px-4 pt-6 pb-4">
            <Link
              href="/dashboard/custom/new"
              className="flex items-center gap-2 rounded-md bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#151515] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
            >
              <Plus className="h-4 w-4" />
              Add Dashboard
            </Link>
          </div>
          <div className="space-y-8">
            {navSections.map((section, sectionIdx) => (
              <div key={section.heading}>
                <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{section.heading}</div>
                <div className="space-y-1">
                  {section.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`relative flex items-center gap-4 rounded-md px-4 py-3 text-sm outline-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${
                          isActive
                            ? "bg-[#6366F1]/5 text-white font-semibold"
                            : "text-gray-300 hover:bg-[#111111] hover:text-white"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                        tabIndex={0}
                        ref={sectionIdx === 0 && itemIdx === 0 ? firstLinkRef : undefined}
                      >
                        <span
                          className={`absolute left-0 top-1/2 h-8 -translate-y-1/2 rounded-r ${
                            isActive ? "w-2 bg-[#6366F1] shadow-[0_0_10px] shadow-[#6366F1]/40" : "w-1 bg-transparent"
                          }`}
                          aria-hidden
                        />
                        <Icon className="h-5 w-5" />
                        <span className="tracking-wide">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
        {/* Account section anchored to bottom */}
        <div className="border-t border-[#151515] p-4">
          {isSignedIn ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0 mr-3">
                <div className="truncate text-sm font-medium text-white">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"}</div>
                {user?.primaryEmailAddress?.emailAddress && (
                  <div className="truncate text-xs text-gray-500">{user.primaryEmailAddress.emailAddress}</div>
                )}
              </div>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonPopoverCard: "bg-[#0A0A0A] border border-[#151515]" } }} />
            </div>
          ) : (
            <Link href="/sign-in" className="block rounded-md border border-[#1A1A1A] px-3 py-2 text-sm text-gray-200 hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]">
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile overlay menu - slide in */}
      <div
        id="dashline-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`md:hidden fixed inset-0 z-40 transition-transform duration-300 ${
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className={`absolute inset-0 bg-black/60`} onClick={() => onOpenChange(false)} />
        <div className="relative h-full w-64 bg-[#0A0A0A] p-6 flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">Dashline</h1>
            <button onClick={() => onOpenChange(false)} aria-label="Close menu" className="rounded p-2 hover:bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Mobile-only project selector */}
          <div className="mb-4 md:hidden">
            {/* Mobile: open a full-screen modal for project selection on small screens */}
            <button
              id="project-select-mobile"
              type="button"
              onClick={() => setMobileModalOpen(true)}
              className="flex w-full items-center justify-between gap-2 truncate rounded-md px-2 py-2 text-sm font-medium text-white bg-[#0F0F0F]"
              aria-haspopup="dialog"
              aria-expanded={mobileModalOpen}
            >
              <span className="flex-1 truncate">{projects?.find((p) => p.id === selected)?.name ?? "Select project"}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {mobileModalOpen && (
              <div className="fixed inset-0 z-[95] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60" onClick={() => setMobileModalOpen(false)} />
                <div
                  role="dialog"
                  aria-modal="true"
                  className="relative w-full h-full max-h-full bg-[#0F0F0F] border-t border-[#262626] p-4 overflow-auto"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white">Select project</div>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setMobileModalOpen(false)}
                      className="rounded p-2 hover:bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>

                  <div className="p-1">
                    <input
                      ref={(el) => {
                        mobileSearchRef.current = el;
                      }}
                      aria-label="Search projects"
                      placeholder="Search projects"
                      className="w-full rounded border border-[#262626] bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-[#6366F1]"
                      value={mobileQuery}
                      onChange={(e) => setMobileQuery(e.target.value)}
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    {filteredMobile.length === 0 ? (
                      <div className="p-3 text-sm text-gray-400">No projects match your search</div>
                    ) : (
                      filteredMobile.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setMobileQuery("");
                            select(p.id || null);
                            if (ctx) ctx.setProjectId(p.id || null);
                            setMobileModalOpen(false);
                            onOpenChange(false);
                          }}
                          className="w-full text-left rounded-md px-3 py-3 text-sm text-white hover:bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* focus management for modal */}
            {mobileModalOpen && (
              <script dangerouslySetInnerHTML={{ __html: `()` }} />
            )}
          </div>
          <nav className="flex-1 flex flex-col gap-6 overflow-auto">
            <Link
              href="/dashboard/custom/new"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#151515] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
            >
              <Plus className="h-4 w-4" />
              Add Dashboard
            </Link>
            {navSections.map((section) => (
              <div key={section.heading}>
                <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{section.heading}</div>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                          isActive ? "bg-[#6366F1] text-white" : "text-gray-200 hover:bg-[#111111] hover:text-white"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto pt-6">
            {isSignedIn ? (
              <div className="flex items-center justify-between">
                <div className="min-w-0 mr-3">
                  <div className="truncate text-sm font-medium text-white">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"}</div>
                  {user?.primaryEmailAddress?.emailAddress && (
                    <div className="truncate text-xs text-gray-500">{user.primaryEmailAddress.emailAddress}</div>
                  )}
                </div>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonPopoverCard: "bg-[#0A0A0A] border border-[#151515]" } }} />
              </div>
            ) : (
              <Link href="/sign-in" className="block rounded-md border border-[#1A1A1A] px-3 py-2 text-sm text-gray-200 hover:bg-[#151515] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
