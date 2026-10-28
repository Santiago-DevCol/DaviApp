import type { DocumentStatusEvent } from '@techdocs/shared';
import { isDocumentStatus } from '@/lib/status';
import { apiUrl } from './client';

export const DOCUMENT_STATUS_EVENT = 'document.status';
export const HEARTBEAT_EVENT = 'heartbeat';

/**
 * Opens the server-sent events stream. Reconnection and `Last-Event-ID`
 * replay are handled natively by the browser's `EventSource`.
 */
export function createDocumentEventSource(): EventSource {
  return new EventSource(apiUrl('/events'));
}

/** Parses the payload of a `document.status` event, rejecting malformed data. */
export function parseDocumentStatusEvent(raw: string): DocumentStatusEvent | null {
  try {
    const payload = JSON.parse(raw) as Partial<DocumentStatusEvent>;
    if (typeof payload.id !== 'string' || !isDocumentStatus(payload.status)) return null;
    return {
      id: payload.id,
      status: payload.status,
      errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
      occurredAt: typeof payload.occurredAt === 'string' ? payload.occurredAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
