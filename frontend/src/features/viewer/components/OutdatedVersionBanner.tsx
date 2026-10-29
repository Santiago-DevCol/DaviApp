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
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface px-5 py-3 text-[13px]"
    >
      <span className="font-bold text-busy">Existe una versión más reciente</span>
      {latest && (
        <Link to={`/documents/${latest.id}`} className="rounded-sm text-accent underline focus-ring">
          Ver v{latest.version}
        </Link>
      )}
    </div>
  );
}
