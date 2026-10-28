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
      className="flex flex-col items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-800">{title}</p>
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} loading={retrying}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
