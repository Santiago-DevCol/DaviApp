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

  const setPage = useCallback(
    (nextPage: number) => {
      setParams((previous) => {
        const updated = new URLSearchParams(previous);
        if (nextPage > 1) updated.set('page', String(nextPage));
        else updated.delete('page');
        return updated;
      });
    },
    [setParams],
  );

  const clear = useCallback(() => setInput(''), []);

  const query = useQuery({
    queryKey: queryKeys.search(q, page, pageSize),
    queryFn: ({ signal }) => searchDocuments({ q, page, pageSize }, signal),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

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
