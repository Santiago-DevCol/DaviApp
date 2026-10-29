import { DocumentStatus } from '@techdocs/shared';
import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiClientError, describeError } from '@/api/client';
import { useDocumentOutline } from '@/app/layout/DocumentOutlineContext';
import { Spinner } from '@/components/atoms';
import { EmptyState, ErrorState } from '@/components/molecules';
import { formatDateTime } from '@/lib/format';
import { extractHeadings, type Heading } from '@/lib/markdownOutline';
import { DocumentBody } from './components/DocumentBody';
import { OutdatedVersionBanner } from './components/OutdatedVersionBanner';
import { MetadataPanel } from './components/MetadataPanel';
import { StatusBanner } from './components/StatusBanner';
import { useDocument } from './useDocument';

interface BackState {
  from?: string;
}

/** Stable empty outline so the shell effect does not re-run on every render. */
const NO_HEADINGS: Heading[] = [];

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const from = (location.state as BackState | null)?.from;
  const backTo = from && from.startsWith('/search') ? from : '/search';
  const query = useDocument(id);
  const data = query.data;

  // Only Markdown carries section headings; the shell shows them from `lg`.
  const outline = useMemo(
    () => (data?.format === 'md' && data.content ? extractHeadings(data.content) : NO_HEADINGS),
    [data],
  );
  useDocumentOutline(outline);

  return (
    <section className="flex flex-col gap-6">
      <Link
        to={backTo}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-[13px] text-accent hover:underline focus-ring"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3 5 8l5 5" />
        </svg>
        Volver a resultados
      </Link>

      {query.isPending && (
        <div className="flex items-center gap-2 py-6 text-ink-soft">
          <Spinner size="sm" /> Cargando documento…
        </div>
      )}

      {query.error != null &&
        (ApiClientError.is(query.error) && query.error.status === 404 ? (
          <EmptyState
            title="Documento no encontrado"
            description="Puede que haya sido eliminado o que el enlace sea incorrecto."
          />
        ) : (
          <ErrorState
            title="No se pudo cargar el documento"
            message={describeError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ))}

      {data && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,68ch)_minmax(0,280px)] lg:items-start">
          <article className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="text-[13px] text-ink-label">
                {data.category} · v{data.version}
              </p>
              <h1 className="font-reading text-[38px] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{data.title}</h1>
              <p className="text-ink-soft">
                {data.author} · {formatDateTime(data.updatedAt)}
              </p>
            </header>

            <StatusBanner status={data.status} errorMessage={data.errorMessage} />
            <OutdatedVersionBanner document={data} />

            {data.status === DocumentStatus.INDEXED && data.content != null ? (
              <DocumentBody format={data.format} content={data.content} />
            ) : (
              <p className="text-ink-soft">
                {data.status === DocumentStatus.INDEXED
                  ? 'El documento no tiene contenido de texto.'
                  : 'El contenido no está disponible todavía.'}
              </p>
            )}
          </article>
          <div className="min-w-0">
            <MetadataPanel document={data} />
          </div>
        </div>
      )}
    </section>
  );
}
