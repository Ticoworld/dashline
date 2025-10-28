"use client";
// Claude P5: Empty state with actionable CTAs and center layout
import React from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title?: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  illustration?: React.ReactNode;
};

export function EmptyState({ title, subtitle, primaryAction, secondaryAction, illustration }: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="mb-4">
        {illustration ?? <Inbox className="w-12 h-12 text-gray-500" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title ?? "No data available"}</h3>
      {subtitle && <p className="text-sm text-gray-400 max-w-lg mb-6">{subtitle}</p>}
      <div className="flex items-center gap-3">
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-5 py-2 bg-[#6366F1] hover:bg-[#5558E3] text-white rounded-md font-medium focus:ring focus:ring-offset-2 focus:ring-[#6366F1]"
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button onClick={secondaryAction.onClick} className="text-sm text-gray-300 underline focus:ring focus:ring-offset-2 focus:ring-[#6366F1]">
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
