import { useLocation } from 'react-router-dom';
import { describeError } from '@/api/client';
import { Spinner } from '@/components/atoms';
import { EmptyState, ErrorState } from '@/components/molecules';
import { SearchLatency } from './components/SearchLatency';
import { Pagination } from './components/Pagination';
import { SearchBar } from './components/SearchBar';
import { SearchResultCard } from './components/SearchResultCard';
import { useSearch } from './useSearch';

export function SearchPage() {
  const location = useLocation();
  const search = useSearch();
  const { data, q } = search;
  const backState = { from: `${location.pathname}${location.search}` };

  return (
    <section className="flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Buscar</h1>
        <p className="text-ink-soft">Búsqueda de texto completo sobre los documentos indexados.</p>
      </div>

      <SearchBar
        value={search.input}
        onChange={search.setInput}
        onClear={search.clear}
        busy={q.length > 0 && search.isFetching}
      />

      {q.length === 0 && (
        <EmptyState
          title="Escribe un término para buscar"
          description="Los resultados muestran fragmentos con las coincidencias resaltadas."
        />
      )}

      {q.length > 0 && search.error != null && (
        <ErrorState
          title="No se pudo completar la búsqueda"
          message={describeError(search.error)}
          onRetry={search.refetch}
          retrying={search.isFetching}
        />
      )}

      {q.length > 0 && search.error == null && search.isPending && (
        <div className="flex items-center gap-2 py-6 text-ink-soft">
          <Spinner size="sm" /> Buscando…
        </div>
      )}

      {q.length > 0 && search.error == null && data && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
            <p aria-live="polite">
              {data.total === 0
                ? 'Sin resultados'
                : `${data.total} ${data.total === 1 ? 'resultado' : 'resultados'} para «${q}»`}
            </p>
            <SearchLatency tookMs={data.tookMs} />
          </div>

          {data.total === 0 ? (
            <EmptyState
              title={`No hay resultados para «${q}»`}
              description="Prueba con otros términos o revisa la ortografía."
            />
          ) : (
            <ul aria-label="Resultados" className="border-b border-line" aria-busy={search.isFetching || undefined}>
              {data.items.map((item) => (
                <li key={item.id}>
                  <SearchResultCard item={item} to={`/documents/${item.id}`} state={backState} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={search.setPage}
            disabled={search.isFetching}
          />
        </>
      )}
    </section>
  );
}
