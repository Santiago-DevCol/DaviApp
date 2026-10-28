import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Job, PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../../shared/queue/pg-boss.provider';
import { IndexDocumentUseCase } from '../../application/index-document.use-case';
import { DocumentNotFoundError } from '../../domain/errors';
import { ensureIndexDocumentQueue, INDEX_DOCUMENT_QUEUE, IndexDocumentJobData } from './index-document.job';

/**
 * Consumes `index-document` jobs one at a time. A thrown error makes pg-boss
 * retry the job (transient failures); deterministic failures are already
 * absorbed by the use case, which settles the document as ERROR instead.
 */
@Injectable()
export class IndexDocumentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexDocumentWorker.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly indexDocument: IndexDocumentUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await ensureIndexDocumentQueue(this.boss);
    await this.boss.work<IndexDocumentJobData>(
      INDEX_DOCUMENT_QUEUE,
      { batchSize: 1 },
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

  private async handle(job: Job<IndexDocumentJobData>): Promise<void> {
    const { documentId } = job.data;
    const startedAt = Date.now();
    this.logger.log(`Indexing document ${documentId} (job ${job.id}, attempt ${job.retryCount + 1})`);

    try {
      await this.indexDocument.execute(documentId);
      this.logger.log(`Finished document ${documentId} in ${Date.now() - startedAt}ms`);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        this.logger.warn(`Document ${documentId} no longer exists; dropping job ${job.id}`);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Indexing document ${documentId} failed (job ${job.id}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
