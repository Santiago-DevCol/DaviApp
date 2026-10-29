import { DocumentRepository } from '../domain/ports/document.repository';
import { FailDocumentUseCase } from './fail-document.use-case';

export const STALE_INDEXING_REASON = 'Indexing timed out';

export interface SweepLogger {
  warn(message: string): void;
}

export interface SweepStaleDocumentsDependencies {
  repository: DocumentRepository;
  failDocument: FailDocumentUseCase;
  /** A PROCESSING document older than this is considered abandoned. */
  staleAfterMinutes: number;
  logger?: SweepLogger;
}

/**
 * Safety net for documents stuck in PROCESSING: the indexing job may have been
 * lost (process killed between accepting the upload and the worker, queue rows
 * archived, worker exhausted without settling). Anything PROCESSING for longer
 * than the threshold (well above the job retry window: 3 retries with backoff
 * plus a 5-minute expiry) is settled as ERROR through the conditional update,
 * so a job that finishes in the meantime still wins. Each document is handled
 * independently: one failure does not stop the sweep. Returns how many
 * documents were settled.
 */
export class SweepStaleDocumentsUseCase {
  private readonly repository: DocumentRepository;
  private readonly failDocument: FailDocumentUseCase;
  private readonly staleAfterMs: number;
  private readonly logger: SweepLogger;

  constructor(deps: SweepStaleDocumentsDependencies) {
    this.repository = deps.repository;
    this.failDocument = deps.failDocument;
    this.staleAfterMs = deps.staleAfterMinutes * 60_000;
    this.logger = deps.logger ?? { warn: () => undefined };
  }

  async execute(now: Date = new Date()): Promise<number> {
    const olderThan = new Date(now.getTime() - this.staleAfterMs);
    const stale = await this.repository.findStaleProcessing(olderThan);

    let settled = 0;
    for (const document of stale) {
      try {
        await this.failDocument.execute(document.id, STALE_INDEXING_REASON);
        settled += 1;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Could not settle stale document ${document.id}: ${detail}`);
      }
    }
    return settled;
  }
}
