import { DocumentStatus } from '@techdocs/shared';
import { Link } from 'react-router-dom';
import { Button, Spinner, StatusDot } from '@/components/atoms';
import type { TrackedUploadView } from '../useTrackedUploads';

export interface TrackedUploadsListProps {
  entries: TrackedUploadView[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * Live status of the documents accepted in this session; the status word flips
 * as SSE events land. Each row is a four-column grid from `md`; below it the
 * name and the remove control share the first line and the status plus the
 * link (or note) the second.
 */
export function TrackedUploadsList({ entries, onRemove, onClear }: TrackedUploadsListProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="tracked-uploads-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tracked-uploads-title" className="text-[13px] font-bold uppercase tracking-wide text-ink-label">
          Cargas recientes
        </h2>
        <Button variant="quiet" onClick={onClear}>
          Limpiar lista
        </Button>
      </div>
      <ul className="border-t border-line">
        {entries.map((entry) =>
          entry.duplicateOf ? (
            <DuplicateRow key={entry.id} entry={entry} duplicateOf={entry.duplicateOf} onRemove={onRemove} />
          ) : (
            <UploadRow key={entry.id} entry={entry} onRemove={onRemove} />
          ),
        )}
      </ul>
    </section>
  );
}

const ROW_CLASS =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line py-3 md:grid-cols-[minmax(0,1fr)_140px_150px_44px]';
const LINK_CLASS = 'w-fit rounded-sm text-[13px] text-accent hover:underline focus-ring';

interface RowProps {
  entry: TrackedUploadView;
  onRemove: (id: string) => void;
}

/** A tracked upload with a live status; the version note appears only when the backend bumped it. */
function UploadRow({ entry, onRemove }: RowProps) {
  const bumped = entry.version && entry.sentVersion && entry.version !== entry.sentVersion;
  return (
    <li className={ROW_CLASS}>
      <div className="min-w-0">
        <p className="truncate font-bold text-ink" title={entry.title}>
          {entry.title}
        </p>
        <p className="truncate text-[13px] text-ink-label">{entry.fileName}</p>
        {bumped && (
          <p className="mt-1 text-[13px] text-ink-soft">
            Versión asignada: v{entry.version}{' '}
            <span className="text-ink-label">(enviada v{entry.sentVersion})</span>
          </p>
        )}
      </div>

      {entry.status ? (
        <StatusDot status={entry.status} />
      ) : entry.loadError ? (
        <StatusDot tone="neutral" label="Desconocido" />
      ) : (
        <Spinner size="sm" label="Consultando estado" />
      )}

      <RowDetail entry={entry} />

      <RemoveButton entry={entry} onRemove={onRemove} />
    </li>
  );
}

/** An upload whose bytes already existed: nothing was created, so there is no status to follow. */
function DuplicateRow({ entry, duplicateOf, onRemove }: RowProps & { duplicateOf: { id: string; version: string } }) {
  return (
    <li className={ROW_CLASS}>
      <div className="min-w-0">
        <p className="truncate font-bold text-ink" title={entry.title}>
          {entry.title}
        </p>
        <p className="truncate text-[13px] text-ink-label">{entry.fileName}</p>
        <p className="mt-1 text-[13px] text-ink-soft">Ya existía como versión {duplicateOf.version}</p>
      </div>

      <StatusDot tone="neutral" label="Duplicado" />

      <Link to={`/documents/${duplicateOf.id}`} className={LINK_CLASS}>
        Ver documento
      </Link>

      <RemoveButton entry={entry} onRemove={onRemove} />
    </li>
  );
}

/** Third cell: the document link once indexed, otherwise the reason the row is not actionable. */
function RowDetail({ entry }: { entry: TrackedUploadView }) {
  if (entry.status === DocumentStatus.INDEXED) {
    return (
      <Link to={`/documents/${entry.id}`} className={LINK_CLASS}>
        Ver documento
      </Link>
    );
  }
  // Notes may be long: below `md` they take a full line of their own.
  const note = 'col-span-2 min-w-0 break-words text-[13px] md:col-span-1';
  if (entry.status === DocumentStatus.ERROR && entry.errorMessage) {
    return <p className={`${note} text-bad`}>{entry.errorMessage}</p>;
  }
  if (!entry.status && entry.loadError) {
    return <p className={`${note} text-ink-label`}>No se pudo consultar el estado: {entry.loadError}</p>;
  }
  return null;
}

function RemoveButton({ entry, onRemove }: RowProps) {
  return (
    <button
      type="button"
      onClick={() => onRemove(entry.id)}
      aria-label={`Dejar de seguir ${entry.fileName}`}
      className="col-start-2 row-start-1 grid h-11 w-11 place-items-center rounded-lg text-ink-soft hover:bg-raised focus-ring md:col-start-4"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        &times;
      </span>
    </button>
  );
}
