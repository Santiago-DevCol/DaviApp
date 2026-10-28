import { DocumentStatus, type DocumentDetail } from '@techdocs/shared';
import type { Query } from '@tanstack/react-query';

/**
 * Safety net when the SSE stream is unavailable or an event is lost: every
 * screen observing a document still processing polls it at this interval.
 */
export const PROCESSING_POLL_MS = 15_000;

/** `refetchInterval` for document queries: poll only while the document is PROCESSING. */
export function processingPollInterval(query: Query<DocumentDetail, Error>): number | false {
  return query.state.data?.status === DocumentStatus.PROCESSING ? PROCESSING_POLL_MS : false;
}
