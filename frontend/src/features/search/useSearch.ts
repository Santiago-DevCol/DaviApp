import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SearchResponse } from '@techdocs/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE_SIZE, searchDocuments } from '@/api/search.api';
import { queryKeys } from '@/lib/queryKeys';

export const SEARCH_DEBOUNCE_MS = 300;

export interface UseSearchResult {
  /** Raw text in the input (not yet debounced). */
  input: string;
  setInput: (value: string) => void;
  clear: () => void;
  /** Committed query taken from the URL (`?q=`). */
  q: string;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  data: SearchResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

function parsePage(raw: string | null): number {
  const page = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Search state lives in the URL (`?q=&page=`), so results are shareable and
 * the browser history works. The text input is debounced before being
 * committed to the URL, which in turn drives the query.
 */
export function useSearch(pageSize = DEFAULT_PAGE_SIZE): UseSearchResult {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const page = parsePage(params.get('page'));

  const [input, setInput] = useState(q);
  const committed = useRef(q);

  // External navigation (back/forward, shared link) updates the input.
  useEffect(() => {
    if (q !== committed.current) {
      committed.current = q;
      setInput(q);
    }
  }, [q]);

  // Debounced commit of the input into the URL; resets to the first page.
  useEffect(() => {
    const next = input.trim();
    if (next === q) return;
    const timer = setTimeout(() => {
      committed.current = next;
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next) updated.set('q', next);
          else updated.delete('q');
          updated.delete('page');
          return updated;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, q, setParams]);

  const navigateToPage = useCallback(
    (nextPage: number, replace = false) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (nextPage > 1) updated.set('page', String(nextPage));
          else updated.delete('page');
          return updated;
        },
        { replace },
      );
    },
    [setParams],
  );

  const setPage = useCallback((nextPage: number) => navigateToPage(nextPage), [navigateToPage]);

  const clear = useCallback(() => setInput(''), []);

  const query = useQuery({
    queryKey: queryKeys.search(q, page, pageSize),
    queryFn: ({ signal }) => searchDocuments({ q, page, pageSize }, signal),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

  // An out-of-range `?page=` (stale link, shrunk result set) lands on an
  // empty page although there are results: replace it with the last valid
  // page. With no results at all the empty state is the right answer.
  const data = query.data;
  useEffect(() => {
    if (!data || data.total === 0 || data.items.length > 0 || data.page <= 1 || data.pageSize <= 0) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
    if (lastPage !== data.page) navigateToPage(lastPage, true);
  }, [data, navigateToPage]);

  return {
    input,
    setInput,
    clear,
    q,
    page,
    pageSize,
    setPage,
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
