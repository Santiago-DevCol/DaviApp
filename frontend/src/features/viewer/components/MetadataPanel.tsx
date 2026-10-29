import type { DocumentDetail } from '@techdocs/shared';
import { Link } from 'react-router-dom';
import { Badge, Tag } from '@/components/atoms';
import { formatBytes, formatDateTime } from '@/lib/format';
import { presentStatus } from '@/lib/status';

export interface MetadataPanelProps {
  document: DocumentDetail;
}

export function MetadataPanel({ document }: MetadataPanelProps) {
  const status = presentStatus(document.status);
  const rows: Array<[string, string]> = [
    ['Autor', document.author],
    ['Categoría', document.category],
    ['Versión', document.version],
    ['Archivo', `${document.fileName} (${document.format.toUpperCase()}, ${formatBytes(document.sizeBytes)})`],
    ['Creado', formatDateTime(document.createdAt)],
    ['Actualizado', formatDateTime(document.updatedAt)],
  ];
  // The hash identifies the exact bytes; 12 hex chars are enough to tell versions apart by eye.
  if (document.contentHash) rows.push(['Huella', document.contentHash.slice(0, 12)]);
  const versions = document.versions ?? [];

  return (
    <aside aria-label="Metadatos" className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadatos</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="break-words text-slate-800">{value}</dd>
          </div>
        ))}
        <dt className="text-slate-500">Etiquetas</dt>
        <dd>
          {document.tags.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {document.tags.map((tag) => (
                <li key={tag}>
                  <Tag>{tag}</Tag>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      {versions.length > 0 && (
        <section aria-labelledby="document-versions-title" className="mt-4 border-t border-slate-200 pt-3">
          <h3 id="document-versions-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Versiones
          </h3>
          <ul aria-label="Versiones" className="mt-2 flex flex-col gap-1.5">
            {versions.map((entry) => {
              const current = entry.id === document.id;
              const status = presentStatus(entry.status);
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-2">
                  {current ? (
                    <span className="font-medium text-slate-900" aria-current="true">
                      v{entry.version}
                    </span>
                  ) : (
                    <Link
                      to={`/documents/${entry.id}`}
                      className="font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      v{entry.version}
                    </Link>
                  )}
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                  {current && <span className="text-xs text-slate-500">(actual)</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
