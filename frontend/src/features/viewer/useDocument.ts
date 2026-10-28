import { useQuery } from '@tanstack/react-query';
import { getDocument } from '@/api/documents.api';
import { processingPollInterval } from '@/lib/polling';
import { queryKeys } from '@/lib/queryKeys';

export { PROCESSING_POLL_MS } from '@/lib/polling';

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.document(id ?? ''),
    queryFn: ({ signal }) => getDocument(id ?? '', signal),
    enabled: Boolean(id),
    // Safety net when the SSE stream is unavailable: poll while still processing.
    refetchInterval: processingPollInterval,
  });
}
