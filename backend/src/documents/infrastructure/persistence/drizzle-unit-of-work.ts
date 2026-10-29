import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import type { Database } from '../../../shared/database/database.provider';
import * as schema from '../../../shared/database/schema';
import { JobQueue } from '../../domain/ports/job-queue';
import { TransactionContext, UnitOfWork } from '../../domain/ports/unit-of-work';
import type { TransactionalDb } from '../queue/pg-boss-job.queue';
import { DrizzleDocumentRepository } from './drizzle-document.repository';

/** Builds the queue bound to the transaction; overridable so tests can inject a failing one. */
export type TransactionalQueueFactory = (db: TransactionalDb) => JobQueue;

/**
 * One PostgreSQL transaction shared by Drizzle and pg-boss.
 *
 * How the sharing works: `Database.$client` is the public `pg.Pool` the app's
 * Drizzle instance was built on. A dedicated `PoolClient` is checked out,
 * `BEGIN` is issued on it, and two views of the same connection are handed to
 * the context:
 *   - `drizzle(client, { schema })`: a Drizzle instance whose every statement
 *     runs on that client, so `DrizzleDocumentRepository` needs no changes;
 *   - `{ executeSql: (text, values) => client.query(text, values) }`: the `Db`
 *     adapter pg-boss accepts in `send(name, data, { db })`, which makes the
 *     job INSERT run on the same connection and therefore inside the same
 *     transaction (verified in pg-boss `manager.js#createJob`: `options.db`
 *     replaces its own pool for that statement).
 * This avoids reaching into Drizzle's `tx.session.client` (a private field of
 * `NodePgTransaction`) and keeps every call on public API. COMMIT/ROLLBACK and
 * the release of the client are handled here; the advisory lock taken through
 * `lockDocumentKey` is transaction-scoped and disappears with either outcome.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  /**
   * Plain class assembled by a factory in `DocumentsModule` (production passes
   * `TransactionalPgBossJobQueue`); tests pass a recording or failing queue.
   */
  constructor(
    private readonly db: Database,
    private readonly createQueue: TransactionalQueueFactory,
  ) {}

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.db.$client.connect();
    try {
      await client.query('BEGIN');
      const ctx = this.contextFor(client);
      let result: T;
      try {
        result = await fn(ctx);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      await client.query('COMMIT');
      return result;
    } finally {
      client.release();
    }
  }

  private contextFor(client: PoolClient): TransactionContext {
    const txDb = drizzle(client, { schema });
    const transactionalDb: TransactionalDb = {
      executeSql: (text, values) => client.query(text, values),
    };
    return {
      repository: new DrizzleDocumentRepository(txDb),
      queue: this.createQueue(transactionalDb),
      lockDocumentKey: async (documentKey) => {
        // hashtext() folds the key into the bigint the lock API expects; a hash
        // collision only serializes two unrelated keys, never breaks correctness.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [documentKey]);
      },
    };
  }
}
