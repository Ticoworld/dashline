"use client";
import React from "react";
import Toast from "./Toast";

type ToastAction = { label: string; onClick: () => void | Promise<void> };
type ToastOpts = {
  id?: string;
  message: string;
  actions?: ToastAction[];
  duration?: number;
  severity?: "info" | "success" | "warn" | "error";
};

type ToastInstance = ToastOpts & { id: string; loading?: boolean };

type ToastContext = {
  showToast: (opts: ToastOpts) => string; // returns toast id
  dismiss: (id?: string) => void; // dismiss specific id or all if omitted
  remove: (id: string) => void; // internal remove
};

const Context = React.createContext<ToastContext | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ToastInstance[]>([]);

  const showToast = React.useCallback((opts: ToastOpts) => {
    const id = opts.id ?? Math.random().toString(36).slice(2, 9);
    const instance: ToastInstance = { ...opts, id, loading: false };
    setQueue((q) => [...q, instance]);
    // auto remove after duration
    const ms = opts.duration ?? 6000;
    window.setTimeout(() => setQueue((q) => q.filter((t) => t.id !== id)), ms);
    return id;
  }, []);

  const dismiss = React.useCallback((id?: string) => {
    if (id) setQueue((q) => q.filter((t) => t.id !== id));
    else setQueue([]);
  }, []);

  const remove = React.useCallback((id: string) => setQueue((q) => q.filter((t) => t.id !== id)), []);

  // helper to run action and show loading for that toast
  const runAction = React.useCallback(async (id: string, action: ToastAction) => {
    setQueue((q) => q.map((t) => (t.id === id ? { ...t, loading: true } : t)));
    try {
      await Promise.resolve(action.onClick());
    } finally {
      setQueue((q) => q.filter((t) => t.id !== id));
    }
  }, []);

  return (
    <Context.Provider value={{ showToast, dismiss, remove }}>
      {children}
      {/* render up to 3 toasts stacked */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
        {queue.slice(-3).map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            severity={t.severity}
            actions={t.actions?.map((a) => ({ label: a.label, onClick: () => runAction(t.id, a) }))}
            onClose={() => remove(t.id)}
          />
        ))}
      </div>
    </Context.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export default ToastProvider;
