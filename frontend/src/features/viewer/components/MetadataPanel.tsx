import type { DocumentDetail } from '@techdocs/shared';
import { Link } from 'react-router-dom';
import { StatusDot, Tag } from '@/components/atoms';
import { formatBytes, formatDateTime } from '@/lib/format';

export interface MetadataPanelProps {
  document: DocumentDetail;
}

/** Boxless metadata column: status first, then a label/value list; stacks above the article on phones. */
export function MetadataPanel({ document }: MetadataPanelProps) {
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
    <aside aria-label="Metadatos" className="flex flex-col gap-5">
      <h2 className="sr-only">Metadatos</h2>
      <StatusDot status={document.status} />
      <dl className="grid gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-ink-label">{label}</dt>
            <dd className="break-words text-[15px] text-ink">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-ink-label">Etiquetas</dt>
          <dd className="text-[15px] text-ink">
            {document.tags.length === 0 ? (
              <span className="text-ink-label">—</span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {document.tags.map((tag) => (
                  <li key={tag}>
                    <Tag>{tag}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      {versions.length > 0 && (
        <section aria-labelledby="document-versions-title" className="border-t border-line pt-5">
          <h3 id="document-versions-title" className="text-xs uppercase tracking-wide text-ink-label">
            Versiones
          </h3>
          <ul aria-label="Versiones" className="mt-2 flex flex-col gap-1.5">
            {versions.map((entry) => {
              const current = entry.id === document.id;
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 text-[15px]">
                  {current ? (
                    <span className="font-bold text-ink" aria-current="true">
                      v{entry.version}
                    </span>
                  ) : (
                    <Link
                      to={`/documents/${entry.id}`}
                      className="rounded-sm font-bold text-accent hover:underline focus-ring"
                    >
                      v{entry.version}
                    </Link>
                  )}
                  <StatusDot status={entry.status} />
                  <span className="text-xs text-ink-label">{formatDateTime(entry.createdAt)}</span>
                  {current && <span className="text-xs text-ink-label">(actual)</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
