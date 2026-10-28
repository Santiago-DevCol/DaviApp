import { useQuery } from '@tanstack/react-query';
import { DocumentStatus } from '@techdocs/shared';
import { getDocument } from '@/api/documents.api';
import { queryKeys } from '@/lib/queryKeys';

/** Safety net when the SSE stream is unavailable: poll while still processing. */
export const PROCESSING_POLL_MS = 15_000;

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.document(id ?? ''),
    queryFn: ({ signal }) => getDocument(id ?? '', signal),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === DocumentStatus.PROCESSING ? PROCESSING_POLL_MS : false,
  });
}
