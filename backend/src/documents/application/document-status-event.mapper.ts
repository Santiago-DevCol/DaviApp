import { DocumentStatusEvent } from '@techdocs/shared';
import { Document } from '../domain/document';

export function toDocumentStatusEvent(document: Document): DocumentStatusEvent {
  const event: DocumentStatusEvent = {
    id: document.id,
    status: document.status,
    occurredAt: document.updatedAt.toISOString(),
  };
  if (document.errorMessage) {
    event.errorMessage = document.errorMessage;
  }
  return event;
}
