"use client";
import React from "react";

type ToastAction = { label: string; onClick: () => void | Promise<void>; loading?: boolean };
export default function Toast({
  message,
  actions,
  onClose,
  severity = "info",
}: {
  message: string;
  actions?: ToastAction[];
  onClose?: () => void;
  severity?: "info" | "success" | "warn" | "error";
}) {
  const styles = React.useMemo(() => {
    switch (severity) {
      case "success":
        return {
          container: "bg-emerald-700 text-white",
          action: "bg-white/15 text-white hover:bg-white/20",
          close: "text-white hover:bg-white/10",
        };
      case "error":
        return {
          container: "bg-rose-700 text-white",
          action: "bg-white/15 text-white hover:bg-white/20",
          close: "text-white hover:bg-white/10",
        };
      case "warn":
        return {
          container: "bg-amber-300 text-black",
          action: "bg-black/10 text-black hover:bg-black/15",
          close: "text-black hover:bg-black/10",
        };
      default:
        return {
          container: "bg-[#111111] text-white",
          action: "bg-white/10 text-white hover:bg-white/20",
          close: "text-gray-200 hover:bg-white/10",
        };
    }
  }, [severity]);
  return (
    <div className="fixed right-6 bottom-6 z-50" role="status" aria-live="assertive">
      <div className={`rounded p-3 shadow-lg flex items-center gap-3 border border-[#151515] ${styles.container} transition-all duration-300 ease-out will-change-transform translate-y-2 opacity-0 data-[state=open]:translate-y-0 data-[state=open]:opacity-100`} data-state="open">
        <div className="text-sm">{message}</div>
        <div className="flex items-center gap-2">
          {actions?.map((a, idx) => (
            <button
              key={idx}
              onClick={a.onClick}
              disabled={a.loading}
              className={`px-3 py-1 rounded text-sm flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-[#0A0A0A] ${styles.action} ${a.loading ? "opacity-60 cursor-not-allowed" : ""}`}>
              {a.loading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : null}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`px-2 py-1 text-sm rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-[#0A0A0A] ${styles.close}`}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
