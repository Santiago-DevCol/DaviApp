import { DocumentStatus } from '@techdocs/shared';
import { Spinner } from '@/components/atoms';

export interface StatusBannerProps {
  status: DocumentStatus;
  errorMessage?: string | null;
}

/** Explains why the body is not available yet (or will never be). Renders nothing when indexed. */
export function StatusBanner({ status, errorMessage }: StatusBannerProps) {
  if (status === DocumentStatus.PROCESSING) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
      >
        <Spinner size="sm" />
        <div>
          <p className="font-semibold">El documento se está procesando</p>
          <p className="text-xs text-sky-800">
            El contenido aparecerá automáticamente cuando termine la indexación.
          </p>
        </div>
      </div>
    );
  }
  if (status === DocumentStatus.ERROR) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <p className="font-semibold">No se pudo procesar el documento</p>
        <p className="text-xs text-red-800">{errorMessage || 'Error desconocido durante la indexación.'}</p>
      </div>
    );
  }
  return null;
}
