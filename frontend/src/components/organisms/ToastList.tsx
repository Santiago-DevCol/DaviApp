import { Link } from 'react-router-dom';
import type { Toast } from '@/features/notifications/ToastContext';

export interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
} as const;

/** Presentational toast stack; the viewport is a polite live region for screen readers. */
export function ToastList({ toasts, onDismiss }: ToastListProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-md ${TONES[toast.tone]}`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{toast.title}</p>
            {toast.description && <p className="truncate text-xs opacity-90">{toast.description}</p>}
            {toast.href && (
              <Link
                to={toast.href}
                onClick={() => onDismiss(toast.id)}
                className="mt-1 inline-block text-xs font-medium underline"
              >
                Ver documento
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
            className="rounded px-1 text-base leading-none opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
