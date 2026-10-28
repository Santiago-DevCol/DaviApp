import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  /** Route to open when the toast is clicked. */
  href?: string;
  /** Auto-dismiss delay; `0` keeps the toast until closed. */
  durationMs?: number;
}

export interface Toast extends ToastInput {
  id: number;
}

export interface ToastApi {
  toasts: Toast[];
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const DEFAULT_DURATION_MS = 6000;
const MAX_VISIBLE = 5;

const ToastContext = createContext<ToastApi | null>(null);

/** Ephemeral UI state for notifications; intentionally outside TanStack Query. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...input, id }].slice(-MAX_VISIBLE));
      const duration = input.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToasts must be used within ToastProvider');
  return context;
}
