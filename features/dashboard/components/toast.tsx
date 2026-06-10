'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Minimal app-wide toast system for action feedback.
 *
 * Mount `<ToastProvider>` once near the dashboard root; any client
 * component below it calls `useToast()` and fires `toast(message, variant)`.
 * Toasts stack bottom-right, auto-dismiss after a per-variant timeout, and
 * can be dismissed manually. Kept dependency-free and intentionally small.
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'neutral';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3500,
  error: 5000,
  warning: 5000,
  neutral: 2000,
};

const VARIANT_STYLE: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-accent/30',
    icon: <CheckCircle2 size={18} className="shrink-0 text-accent" />,
  },
  error: {
    border: 'border-risk-high/40',
    icon: <AlertTriangle size={18} className="shrink-0 text-risk-high" />,
  },
  warning: {
    border: 'border-risk-medium/40',
    icon: <TriangleAlert size={18} className="shrink-0 text-risk-medium" />,
  },
  neutral: {
    border: 'border-surface-border',
    icon: <Info size={18} className="shrink-0 text-secondary" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'neutral') => {
      const id = nextId.current;
      nextId.current += 1;
      setItems((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), DEFAULT_DURATION[variant]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2">
        {items.map((t) => {
          const style = VARIANT_STYLE[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-fade-up pointer-events-auto flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-2xl shadow-black/40 ${style.border}`}
            >
              {style.icon}
              <span className="flex-1 text-sm font-medium text-primary">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="ml-1 rounded p-0.5 text-muted transition-colors hover:text-primary"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns a `toast(message, variant)` function. Outside a provider it
 * degrades to a no-op so components stay safe to render anywhere.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { toast: () => undefined };
}
