"use client";
import * as React from "react";

// Temporary brand icon for Dashline until a real logo is provided.
// Uses a simple spark + line mark.
export function Logo({ size = 20, label = "Dashline" }: { size?: number; label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="dl_g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="url(#dl_g)" strokeWidth="2" fill="none" />
        <path d="M6 14l4-4 3 3 5-5" stroke="url(#dl_g)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="14" r="1.25" fill="#6366F1" />
        <circle cx="10" cy="10" r="1.25" fill="#7C83F9" />
        <circle cx="13" cy="13" r="1.25" fill="#8B5CF6" />
        <circle cx="18" cy="8" r="1.25" fill="#9D7BFA" />
      </svg>
      <span className="font-semibold tracking-tight">{label}</span>
    </div>
  );
}

export default Logo;
