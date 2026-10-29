import { Button } from '../atoms/Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = 'Algo salió mal',
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface px-5 py-4"
    >
      <p className="font-bold text-bad">{title}</p>
      <p className="text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} loading={retrying}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
