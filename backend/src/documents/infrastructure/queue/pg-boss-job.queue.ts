import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../../shared/queue/pg-boss.provider';
import { JobQueue } from '../../domain/ports/job-queue';
import {
  ensureIndexDocumentQueue,
  INDEX_DOCUMENT_JOB_OPTIONS,
  INDEX_DOCUMENT_QUEUE,
  IndexDocumentJobData,
} from './index-document.job';

@Injectable()
export class PgBossJobQueue implements JobQueue, OnModuleInit {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onModuleInit(): Promise<void> {
    await ensureIndexDocumentQueue(this.boss);
  }

  async enqueueIndexDocument(documentId: string): Promise<void> {
    const data: IndexDocumentJobData = { documentId };
    const jobId = await this.boss.send(INDEX_DOCUMENT_QUEUE, data, INDEX_DOCUMENT_JOB_OPTIONS);
    if (!jobId) {
      // send() only returns null when a singleton/throttle policy drops the job; we use neither.
      throw new Error(`pg-boss did not accept the indexing job for document ${documentId}`);
    }
  }
}
