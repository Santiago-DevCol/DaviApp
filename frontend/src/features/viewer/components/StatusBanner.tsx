import { DocumentStatus } from '@techdocs/shared';
import { Spinner } from '@/components/atoms';

export interface StatusBannerProps {
  status: DocumentStatus;
  errorMessage?: string | null;
}

const BOX = 'rounded-xl border border-line bg-surface px-5 py-4';

/** Explains why the body is not available yet (or will never be). Renders nothing when indexed. */
export function StatusBanner({ status, errorMessage }: StatusBannerProps) {
  if (status === DocumentStatus.PROCESSING) {
    return (
      <div role="status" className={`flex items-center gap-3 ${BOX}`}>
        <Spinner size="sm" />
        <div>
          <p className="font-bold text-ink">El documento se está procesando</p>
          <p className="text-[13px] text-ink-soft">
            El contenido aparecerá automáticamente cuando termine la indexación.
          </p>
        </div>
      </div>
    );
  }
  if (status === DocumentStatus.ERROR) {
    return (
      <div role="alert" className={BOX}>
        <p className="font-bold text-bad">No se pudo procesar el documento</p>
        <p className="text-[13px] text-ink-soft">{errorMessage || 'Error desconocido durante la indexación.'}</p>
      </div>
    );
  }
  return null;
}
