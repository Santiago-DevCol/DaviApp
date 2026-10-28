import { DocumentStatusEvent } from '@techdocs/shared';
import { Document } from '../domain/document';
import { DocumentNotFoundError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { EventPublisher } from '../domain/ports/event-publisher';
import { FileStorage } from '../domain/ports/file-storage';
import { TextExtractor } from '../domain/ports/text-extractor';

export interface IndexDocumentDependencies {
  repository: DocumentRepository;
  storage: FileStorage;
  extractor: TextExtractor;
  publisher: EventPublisher;
}

const NO_TEXT_REASON = 'No extractable text found';

/**
 * HU-01 step 2, executed by the background worker. Extraction problems are
 * deterministic (same bytes, same outcome), so they end the document in ERROR
 * and resolve normally: retrying would only burn worker time. Persistence
 * failures are transient and propagate so the queue retries the job.
 */
export class IndexDocumentUseCase {
  private readonly repository: DocumentRepository;
  private readonly storage: FileStorage;
  private readonly extractor: TextExtractor;
  private readonly publisher: EventPublisher;

  constructor(deps: IndexDocumentDependencies) {
    this.repository = deps.repository;
    this.storage = deps.storage;
    this.extractor = deps.extractor;
    this.publisher = deps.publisher;
  }

  async execute(documentId: string): Promise<void> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }
    if (!document.isProcessing()) {
      return; // Already settled by a previous attempt; the job is idempotent.
    }

    try {
      const buffer = await this.storage.read(document.storageKey);
      const text = await this.extractor.extract(buffer, document.format);
      if (text.trim().length === 0) {
        document.markFailed(NO_TEXT_REASON);
      } else {
        document.markIndexed(text);
      }
    } catch (error) {
      document.markFailed(describe(error));
    }

    await this.repository.update(document);
    this.publisher.publish(toEvent(document));
  }
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Unknown extraction error';
}

function toEvent(document: Document): DocumentStatusEvent {
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
