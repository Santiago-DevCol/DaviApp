import { DocumentStatus } from '@techdocs/shared';
import { Link } from 'react-router-dom';
import { Badge, Button, Spinner } from '@/components/atoms';
import { presentStatus } from '@/lib/status';
import type { TrackedUploadView } from '../useTrackedUploads';

export interface TrackedUploadsListProps {
  entries: TrackedUploadView[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

/** Live status of the documents accepted in this session; badges flip as SSE events land. */
export function TrackedUploadsList({ entries, onRemove, onClear }: TrackedUploadsListProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="tracked-uploads-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="tracked-uploads-title" className="text-sm font-semibold text-slate-800">
          Cargas recientes
        </h2>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpiar lista
        </Button>
      </div>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {entries.map((entry) => {
          if (entry.duplicateOf) {
            return <DuplicateRow key={entry.id} entry={entry} duplicateOf={entry.duplicateOf} onRemove={onRemove} />;
          }
          const presentation = entry.status ? presentStatus(entry.status) : null;
          const bumped = entry.version && entry.sentVersion && entry.version !== entry.sentVersion;
          return (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900" title={entry.title}>
                  {entry.title}
                </p>
                <p className="truncate text-xs text-slate-500">{entry.fileName}</p>
                {bumped && (
                  <p className="mt-1 text-xs text-slate-600">
                    Versión asignada: v{entry.version}{' '}
                    <span className="text-slate-400">(enviada v{entry.sentVersion})</span>
                  </p>
                )}
                {entry.status === DocumentStatus.ERROR && entry.errorMessage && (
                  <p className="mt-1 text-xs text-red-700">{entry.errorMessage}</p>
                )}
                {entry.loadError && !entry.status && (
                  <p className="mt-1 text-xs text-red-700">No se pudo consultar el estado: {entry.loadError}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {presentation ? (
                  <Badge tone={presentation.tone}>
                    {entry.status === DocumentStatus.PROCESSING && <Spinner size="sm" label="Procesando" />}
                    {presentation.label}
                  </Badge>
                ) : entry.loadError ? (
                  <Badge tone="neutral">Desconocido</Badge>
                ) : (
                  <Spinner size="sm" label="Consultando estado" />
                )}
                {entry.status === DocumentStatus.INDEXED && (
                  <Link to={`/documents/${entry.id}`} className={LINK_CLASS}>
                    Ver documento
                  </Link>
                )}
                <RemoveButton entry={entry} onRemove={onRemove} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const LINK_CLASS =
  'text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

interface RowProps {
  entry: TrackedUploadView;
  onRemove: (id: string) => void;
}

/** An upload whose bytes already existed: nothing was created, so there is no status to follow. */
function DuplicateRow({ entry, duplicateOf, onRemove }: RowProps & { duplicateOf: { id: string; version: string } }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900" title={entry.title}>
          {entry.title}
        </p>
        <p className="truncate text-xs text-slate-500">{entry.fileName}</p>
        <p className="mt-1 text-xs text-slate-600">Ya existía como versión {duplicateOf.version}</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone="neutral">Duplicado</Badge>
        <Link to={`/documents/${duplicateOf.id}`} className={LINK_CLASS}>
          Ver documento
        </Link>
        <RemoveButton entry={entry} onRemove={onRemove} />
      </div>
    </li>
  );
}

function RemoveButton({ entry, onRemove }: RowProps) {
  return (
    <button
      type="button"
      onClick={() => onRemove(entry.id)}
      aria-label={`Dejar de seguir ${entry.fileName}`}
      className="rounded px-1 text-base leading-none text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      &times;
    </button>
  );
}
