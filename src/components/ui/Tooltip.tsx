"use client";
import React from "react";

type TooltipProps = {
  content: string | React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
};

export function Tooltip({ content, children, side = "top", delayMs = 300 }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function show() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delayMs);
  }
  function hide() {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  }

  const positions: Record<string, string> = {
    top: "-translate-x-1/2 bottom-full left-1/2 mb-1",
    bottom: "-translate-x-1/2 top-full left-1/2 mt-1",
    left: "-translate-y-1/2 right-full top-1/2 mr-1",
    right: "-translate-y-1/2 left-full top-1/2 ml-1",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {mounted && open && (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-50 whitespace-pre rounded-md border border-[#1A1A1A] bg-[#0A0A0A]/95 px-2 py-1 text-xs text-white shadow-lg transform ${positions[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
