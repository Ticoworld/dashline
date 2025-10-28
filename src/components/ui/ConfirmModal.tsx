"use client";
import React, { useEffect, useRef } from "react";

export default function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onClose,
  isLoading,
}: {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    // delay to allow the dialog to mount
    setTimeout(() => cancelRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      try {
        if (previouslyFocused.current && (previouslyFocused.current as HTMLElement).focus) (previouslyFocused.current as HTMLElement).focus();
      } catch {}
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded bg-[#0A0A0A] border border-[#151515] p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-gray-400 mt-2">{description}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onClose} className="px-3 py-2 rounded bg-[#111111] text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className="px-3 py-2 rounded bg-red-600 text-sm text-white">{isLoading ? 'Working...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
