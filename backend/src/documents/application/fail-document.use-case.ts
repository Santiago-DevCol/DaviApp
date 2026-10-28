import { DocumentNotFoundError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { EventPublisher } from '../domain/ports/event-publisher';
import { toDocumentStatusEvent } from './document-status-event.mapper';

export interface FailDocumentDependencies {
  repository: DocumentRepository;
  publisher: EventPublisher;
}

/**
 * Last-resort settlement for a document whose indexing job exhausted its
 * retries: the worker calls this once the queue will not try again, so the
 * document does not stay PROCESSING forever and the UI learns about the ERROR.
 * Content is cleared by `markFailed`, which keeps this write minimal and
 * independent of whatever made the INDEXED write fail (for example a text too
 * large for the generated search vector). A document already settled by an
 * earlier attempt is left untouched. Repository failures propagate so the
 * caller can log them.
 */
export class FailDocumentUseCase {
  private readonly repository: DocumentRepository;
  private readonly publisher: EventPublisher;

  constructor(deps: FailDocumentDependencies) {
    this.repository = deps.repository;
    this.publisher = deps.publisher;
  }

  async execute(documentId: string, reason: string): Promise<void> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }
    if (!document.isProcessing()) {
      return;
    }

    document.markFailed(reason);
    await this.repository.update(document);
    this.publisher.publish(toDocumentStatusEvent(document));
  }
}
