"use client";
import * as React from "react";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs transition-colors border ${
        checked ? "bg-[#1B1C2E] border-[#2A2C44] text-white" : "bg-[#0F0F0F] border-[#1A1A1A] text-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-colors ${
          checked ? "bg-[#6366F1]" : "bg-[#333333]"
        }`}
      />
      <span className="select-none">{label}</span>
    </button>
  );
}

export default Toggle;
