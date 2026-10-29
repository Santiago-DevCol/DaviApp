import { DocumentRepository } from './document.repository';
import { JobQueue } from './job-queue';

/**
 * Everything a use case may touch inside one atomic unit: a repository and a
 * job queue bound to the same database transaction, plus a per-key mutex that
 * lives until the transaction ends (Postgres `pg_advisory_xact_lock`). If the
 * callback throws, nothing written through the context survives.
 */
export interface TransactionContext {
  repository: DocumentRepository;
  queue: JobQueue;
  /** Serializes callers on the same document key until the transaction ends. */
  lockDocumentKey(documentKey: string): Promise<void>;
}

export interface UnitOfWork {
  run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
