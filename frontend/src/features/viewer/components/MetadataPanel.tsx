import type { DocumentDetail } from '@techdocs/shared';
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
    </aside>
  );
}
