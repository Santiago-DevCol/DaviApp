import { Link } from 'react-router-dom';
import type { Toast } from '@/features/notifications/ToastContext';

export interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/** Tone is carried by a small dot instead of a tinted box. */
const TONE_DOT = {
  info: 'bg-accent',
  success: 'bg-ok',
  danger: 'bg-bad',
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
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-[15px] text-ink"
        >
          <span
            aria-hidden="true"
            className={`mt-2 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[toast.tone]}`}
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{toast.title}</p>
            {toast.description && (
              <p className="truncate text-[13px] text-ink-soft">{toast.description}</p>
            )}
            {toast.href && (
              <Link
                to={toast.href}
                onClick={() => onDismiss(toast.id)}
                className="mt-1 inline-block text-[13px] text-accent underline focus-ring"
              >
                Ver documento
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
            className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl leading-none text-ink-soft hover:bg-surface hover:text-ink focus-ring"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      ))}
    </div>
  );
}
