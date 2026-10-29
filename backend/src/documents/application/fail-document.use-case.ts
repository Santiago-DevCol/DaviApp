import { DocumentNotFoundError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { EventPublisher } from '../domain/ports/event-publisher';
import { toDocumentStatusEvent } from './document-status-event.mapper';

export interface FailDocumentDependencies {
  repository: DocumentRepository;
  publisher: EventPublisher;
  clock?: () => Date;
}

/**
 * Last-resort settlement for a document whose indexing will not complete: the
 * worker calls it once the queue will not retry, and the stale sweeper when a
 * job vanished. The write is a single conditional UPDATE (`WHERE status =
 * PROCESSING`), so a document settled concurrently by an INDEXED write is left
 * untouched and no event is published for it. Content is cleared with the
 * failure, which keeps the write minimal and independent of whatever made the
 * INDEXED write fail (for example a text too large for the generated search
 * vector). Repository failures propagate so the caller can log them.
 */
export class FailDocumentUseCase {
  private readonly repository: DocumentRepository;
  private readonly publisher: EventPublisher;
  private readonly clock: () => Date;

  constructor(deps: FailDocumentDependencies) {
    this.repository = deps.repository;
    this.publisher = deps.publisher;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(documentId: string, reason: string): Promise<void> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const at = this.clock();
    const settled = await this.repository.markFailedIfProcessing(documentId, reason, at);
    if (!settled) {
      return;
    }

    // The row just moved from PROCESSING to ERROR, so the copy read moments ago
    // (also PROCESSING: status only moves forward) mirrors the persisted state.
    document.markFailed(reason, at);
    this.publisher.publish(toDocumentStatusEvent(document));
  }
}
