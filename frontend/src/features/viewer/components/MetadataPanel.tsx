import type { DocumentDetail } from '@techdocs/shared';
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
    </aside>
  );
}
