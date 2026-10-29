import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Job, PgBoss } from 'pg-boss';
import { describeError, errorStackFrames } from '../../../shared/errors/error-details';
import { PG_BOSS } from '../../../shared/queue/pg-boss.provider';
import { FailDocumentUseCase } from '../../application/fail-document.use-case';
import { IndexDocumentUseCase } from '../../application/index-document.use-case';
import { publicIndexingFailure } from '../../application/indexing-failure';
import { DocumentNotFoundError } from '../../domain/errors';
import {
  ensureIndexDocumentQueue,
  INDEX_DOCUMENT_JOB_OPTIONS,
  INDEX_DOCUMENT_QUEUE,
  IndexDocumentJobData,
} from './index-document.job';

/**
 * The job as the worker needs it. `retryLimit` comes with `includeMetadata`;
 * it is optional here so a job fetched without metadata still resolves the
 * limit from the queue configuration.
 */
export type IndexDocumentJob = Job<IndexDocumentJobData> & { retryLimit?: number };

const MAX_REASON_LENGTH = 300;

/**
 * Consumes `index-document` jobs one at a time. A thrown error makes pg-boss
 * retry the job (transient failures); deterministic failures are already
 * absorbed by the use case, which settles the document as ERROR instead. On
 * the last attempt the worker settles the document itself before rethrowing,
 * so an exhausted job never leaves a document PROCESSING forever.
 */
@Injectable()
export class IndexDocumentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexDocumentWorker.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly indexDocument: IndexDocumentUseCase,
    private readonly failDocument: FailDocumentUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await ensureIndexDocumentQueue(this.boss);
    await this.boss.work<IndexDocumentJobData>(
      INDEX_DOCUMENT_QUEUE,
      { batchSize: 1, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.handle(job);
        }
      },
    );
    this.logger.log(`Worker registered on queue "${INDEX_DOCUMENT_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.boss.offWork(INDEX_DOCUMENT_QUEUE);
    } catch {
      // The boss may already be stopped; nothing left to unregister.
    }
  }

  async handle(job: IndexDocumentJob): Promise<void> {
    const { documentId } = job.data;
    const attempt = job.retryCount + 1;
    const startedAt = Date.now();
    this.logger.log(`Indexing document ${documentId} (job ${job.id}, attempt ${attempt})`);

    try {
      await this.indexDocument.execute(documentId);
      this.logger.log(`Finished document ${documentId} in ${Date.now() - startedAt}ms`);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        this.logger.warn(`Document ${documentId} no longer exists; dropping job ${job.id}`);
        return;
      }
      const detail = describeError(error);
      this.logger.error(
        `Indexing document ${documentId} failed (job ${job.id}, attempt ${attempt}): ${detail}`,
        errorStackFrames(error),
      );
      if (isLastAttempt(job)) {
        await this.settleAsFailed(documentId, attempt, publicIndexingFailure(error));
      }
      throw error;
    }
  }

  private async settleAsFailed(documentId: string, attempts: number, message: string): Promise<void> {
    const reason = `No se pudo indexar después de ${attempts} intentos. ${message}`.slice(
      0,
      MAX_REASON_LENGTH,
    );
    try {
      await this.failDocument.execute(documentId, reason);
      this.logger.warn(`Document ${documentId} settled as ERROR after ${attempts} attempts`);
    } catch (fallbackError) {
      this.logger.error(
        `Could not settle document ${documentId} as ERROR: ${describeError(fallbackError)}`,
        errorStackFrames(fallbackError),
      );
    }
  }
}

function isLastAttempt(job: IndexDocumentJob): boolean {
  const retryLimit = job.retryLimit ?? INDEX_DOCUMENT_JOB_OPTIONS.retryLimit ?? 0;
  return job.retryCount >= retryLimit;
}
