import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Db, PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../../shared/queue/pg-boss.provider';
import { JobQueue } from '../../domain/ports/job-queue';
import {
  ensureIndexDocumentQueue,
  INDEX_DOCUMENT_JOB_OPTIONS,
  INDEX_DOCUMENT_QUEUE,
  IndexDocumentJobData,
} from './index-document.job';

/**
 * The subset of pg-boss' `Db` adapter needed to route a `send()` through an
 * external connection: pg-boss runs the job INSERT with `executeSql` instead
 * of its own pool, so the insert joins whatever transaction that connection has
 * open. `DrizzleUnitOfWork` builds it from the transaction's `PoolClient`.
 */
export type TransactionalDb = Pick<Db, 'executeSql'>;

async function sendIndexDocumentJob(boss: PgBoss, documentId: string, db?: TransactionalDb): Promise<void> {
  const data: IndexDocumentJobData = { documentId };
  const jobId = await boss.send(INDEX_DOCUMENT_QUEUE, data, { ...INDEX_DOCUMENT_JOB_OPTIONS, db: db as Db });
  if (!jobId) {
    // send() only returns null when a singleton/throttle policy drops the job; we use neither.
    throw new Error(`pg-boss did not accept the indexing job for document ${documentId}`);
  }
}

/** Application-wide queue: jobs go through pg-boss' own pool (autocommit). */
@Injectable()
export class PgBossJobQueue implements JobQueue, OnModuleInit {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onModuleInit(): Promise<void> {
    await ensureIndexDocumentQueue(this.boss);
  }

  async enqueueIndexDocument(documentId: string): Promise<void> {
    await sendIndexDocumentJob(this.boss, documentId);
  }
}

/**
 * Queue bound to one open transaction: the job becomes visible to workers only
 * when the caller commits, and vanishes with a rollback. Not a Nest provider;
 * `DrizzleUnitOfWork` instantiates one per transaction.
 */
export class TransactionalPgBossJobQueue implements JobQueue {
  constructor(
    private readonly boss: PgBoss,
    private readonly db: TransactionalDb,
  ) {}

  async enqueueIndexDocument(documentId: string): Promise<void> {
    await sendIndexDocumentJob(this.boss, documentId, this.db);
  }
}
