import type { DocumentDetail } from '@techdocs/shared';
import { Link } from 'react-router-dom';

export interface OutdatedVersionBannerProps {
  document: DocumentDetail;
}

/** Discreet notice shown on superseded versions; renders nothing on the latest one. */
export function OutdatedVersionBanner({ document }: OutdatedVersionBannerProps) {
  if (document.isLatest !== false) return null;
  const latest = document.versions?.find((entry) => entry.isLatest && entry.id !== document.id);
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <span>Existe una versión más reciente</span>
      {latest && (
        <Link
          to={`/documents/${latest.id}`}
          className="font-medium text-amber-900 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Ver v{latest.version}
        </Link>
      )}
    </div>
  );
}
