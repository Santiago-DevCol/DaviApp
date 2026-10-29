import { DocumentStatus } from '@techdocs/shared';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiClientError, describeError } from '@/api/client';
import { Spinner } from '@/components/atoms';
import { EmptyState, ErrorState } from '@/components/molecules';
import { DocumentBody } from './components/DocumentBody';
import { OutdatedVersionBanner } from './components/OutdatedVersionBanner';
import { MetadataPanel } from './components/MetadataPanel';
import { StatusBanner } from './components/StatusBanner';
import { useDocument } from './useDocument';

interface BackState {
  from?: string;
}

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const from = (location.state as BackState | null)?.from;
  const backTo = from && from.startsWith('/search') ? from : '/search';
  const query = useDocument(id);

  return (
    <section className="flex flex-col gap-4">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1 text-sm text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span aria-hidden="true">←</span> Volver a resultados
      </Link>

      {query.isPending && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
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

      {query.data && (
        <>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">{query.data.title}</h1>
          </header>

          <StatusBanner status={query.data.status} errorMessage={query.data.errorMessage} />
          <OutdatedVersionBanner document={query.data} />

          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <article className="order-2 min-w-0 rounded-lg border border-slate-200 bg-white p-4 lg:order-1 lg:p-6">
              {query.data.status === DocumentStatus.INDEXED && query.data.content != null ? (
                <DocumentBody format={query.data.format} content={query.data.content} />
              ) : (
                <p className="text-sm text-slate-500">
                  {query.data.status === DocumentStatus.INDEXED
                    ? 'El documento no tiene contenido de texto.'
                    : 'El contenido no está disponible todavía.'}
                </p>
              )}
            </article>
            <div className="order-1 lg:order-2">
              <MetadataPanel document={query.data} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
