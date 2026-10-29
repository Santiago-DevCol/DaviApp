/**
 * Atomicity and concurrency of the upload flow against a real PostgreSQL and a
 * real pg-boss (same database selection as the other integration suites:
 * Testcontainers by default, `TEST_DATABASE_URL` as a fallback; the suite
 * truncates `documents` and the `index-document` jobs).
 *
 * Covers what unit tests cannot: the Drizzle statements and the pg-boss job
 * INSERT sharing one transaction (rollback removes both), the per-key advisory
 * lock serializing concurrent uploads, the conditional failure UPDATE and the
 * stale sweeper over real rows.
 */
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DocumentStatus } from '@techdocs/shared';
import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { FixedIdGenerator } from '../src/documents/application/__fakes__/fixed-id.generator';
import { RecordingEventPublisher } from '../src/documents/application/__fakes__/recording-event.publisher';
import { RecordingJobQueue } from '../src/documents/application/__fakes__/recording-job.queue';
import { FailDocumentUseCase } from '../src/documents/application/fail-document.use-case';
import {
  STALE_INDEXING_REASON,
  SweepStaleDocumentsUseCase,
} from '../src/documents/application/sweep-stale-documents.use-case';
import { UploadDocumentsUseCase } from '../src/documents/application/upload-documents.use-case';
import { JobQueue } from '../src/documents/domain/ports/job-queue';
import { DrizzleDocumentRepository } from '../src/documents/infrastructure/persistence/drizzle-document.repository';
import {
  DrizzleUnitOfWork,
  TransactionalQueueFactory,
} from '../src/documents/infrastructure/persistence/drizzle-unit-of-work';
import { ensureIndexDocumentQueue, INDEX_DOCUMENT_QUEUE } from '../src/documents/infrastructure/queue/index-document.job';
import { TransactionalPgBossJobQueue } from '../src/documents/infrastructure/queue/pg-boss-job.queue';
import { LocalFileStorage } from '../src/documents/infrastructure/storage/local-file.storage';
import {
  createDatabase,
  createPool,
  Database,
  runMigrations,
} from '../src/shared/database/database.provider';
import { documents, NewDocumentRow } from '../src/shared/database/schema';
import { PG_BOSS_SCHEMA } from '../src/shared/queue/pg-boss.provider';

const CONTAINER_START_TIMEOUT_MS = 180_000;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const metadata = (version = '1.0.0') => ({
  title: 'Manual de Grúa',
  author: 'Ana Torres',
  category: 'manuals',
  tags: ['crane'],
  version,
});

function processingRow(id: string, createdAt: Date, overrides: Partial<NewDocumentRow> = {}): NewDocumentRow {
  return {
    id,
    title: `Doc ${id}`,
    author: 'Equipo de pruebas',
    category: 'Fixtures',
    tags: [],
    version: '1.0.0',
    fileName: `${id}.md`,
    format: 'md',
    storageKey: `${id}.md`,
    sizeBytes: 10,
    status: DocumentStatus.PROCESSING,
    errorMessage: null,
    content: null,
    documentKey: `doc ${id}|equipo de pruebas`,
    contentHash: sha256(id),
    isLatest: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('Upload atomicity and concurrency (integration)', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool;
  let db: Database;
  let boss: PgBoss;
  let storageDir: string;
  let storage: LocalFileStorage;

  beforeAll(async () => {
    let connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      connectionString = container.getConnectionUri();
    }
    pool = createPool(connectionString);
    db = createDatabase(pool);
    await runMigrations(db);

    // No workers, no supervision: the suite only needs `send()` and the job table.
    boss = new PgBoss({ connectionString, schema: PG_BOSS_SCHEMA, supervise: false, schedule: false });
    boss.on('error', () => undefined);
    await boss.start();
    await ensureIndexDocumentQueue(boss);

    storageDir = await mkdtemp(path.join(tmpdir(), 'techdocs-atomicity-'));
    storage = new LocalFileStorage(storageDir);
  }, CONTAINER_START_TIMEOUT_MS);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE documents`);
    await pool.query(`DELETE FROM ${PG_BOSS_SCHEMA}.job WHERE name = $1`, [INDEX_DOCUMENT_QUEUE]);
    for (const name of await readdir(storageDir)) {
      await rm(path.join(storageDir, name), { force: true });
    }
  });

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    await pool?.end();
    await container?.stop();
    await rm(storageDir, { recursive: true, force: true });
  });

  const uploader = (createQueue: TransactionalQueueFactory, ids: string[]) =>
    new UploadDocumentsUseCase({
      repository: new DrizzleDocumentRepository(db),
      unitOfWork: new DrizzleUnitOfWork(db, createQueue),
      storage,
      idGenerator: new FixedIdGenerator(ids),
    });

  const upload = (useCase: UploadDocumentsUseCase, fileName: string, text: string, version = '1.0.0') => {
    const buffer = Buffer.from(text, 'utf8');
    return useCase.execute({
      files: [{ fileName, mimeType: 'text/plain', sizeBytes: buffer.byteLength, buffer }],
      metadata: [metadata(version)],
    });
  };

  const indexJobs = async () => {
    const result = await pool.query<{ document_id: string }>(
      `SELECT data->>'documentId' AS document_id FROM ${PG_BOSS_SCHEMA}.job WHERE name = $1 ORDER BY created_on`,
      [INDEX_DOCUMENT_QUEUE],
    );
    return result.rows.map((row) => row.document_id);
  };

  it('commits the row and the pg-boss job together through the shared transaction', async () => {
    const id = randomUUID();
    const useCase = uploader((txDb) => new TransactionalPgBossJobQueue(boss, txDb), [id]);

    const response = await upload(useCase, 'v1.txt', 'contenido original');

    expect(response.items[0]).toMatchObject({ id, status: DocumentStatus.PROCESSING, version: '1.0.0' });
    expect((await pool.query('SELECT id FROM documents')).rows).toEqual([{ id }]);
    expect(await indexJobs()).toEqual([id]);
    expect(await readdir(storageDir)).toEqual([`${id}.txt`]);
  });

  it('rolls back the row and the already inserted pg-boss job and deletes the file when enqueue fails', async () => {
    const id = randomUUID();
    const failure = new Error('simulated failure after the job insert');
    // The real transactional send runs first, so the rollback has a real job row to discard.
    const failingAfterSend: TransactionalQueueFactory = (txDb) => {
      const real = new TransactionalPgBossJobQueue(boss, txDb);
      const queue: JobQueue = {
        enqueueIndexDocument: async (documentId) => {
          await real.enqueueIndexDocument(documentId);
          throw failure;
        },
      };
      return queue;
    };

    await expect(upload(uploader(failingAfterSend, [id]), 'v1.txt', 'contenido original')).rejects.toBe(failure);

    expect((await pool.query('SELECT count(*)::int AS n FROM documents')).rows[0].n).toBe(0);
    expect(await indexJobs()).toEqual([]);
    expect(await readdir(storageDir)).toEqual([]);
  });

  it('serializes two concurrent uploads of the same key: versions 1.0.0 and 1.0.1, exactly one latest', async () => {
    const queue = new RecordingJobQueue();
    const ids = [randomUUID(), randomUUID()];
    const [first, second] = ids.map((id) => uploader(() => queue, [id]));

    const responses = await Promise.all([
      upload(first, 'a.txt', 'primer contenido'),
      upload(second, 'b.txt', 'segundo contenido'),
    ]);

    const versions = responses.map((response) => response.items[0].version).sort();
    expect(versions).toEqual(['1.0.0', '1.0.1']);

    const rows = await pool.query<{ id: string; version: string; is_latest: boolean }>(
      'SELECT id, version, is_latest FROM documents ORDER BY version',
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.filter((row) => row.is_latest)).toHaveLength(1);
    expect(rows.rows.find((row) => row.is_latest)?.version).toBe('1.0.1');
    expect(queue.enqueued.sort()).toEqual([...ids].sort());
    expect((await readdir(storageDir)).sort()).toEqual(ids.map((id) => `${id}.txt`).sort());
  });

  it('sweeper settles a 20-minute-old PROCESSING row as ERROR and leaves a fresh one alone', async () => {
    const now = new Date();
    const stale = randomUUID();
    const fresh = randomUUID();
    await db.insert(documents).values([
      processingRow(stale, new Date(now.getTime() - 20 * 60_000)),
      processingRow(fresh, new Date(now.getTime() - 60_000)),
    ]);
    const repository = new DrizzleDocumentRepository(db);
    const publisher = new RecordingEventPublisher();
    const sweeper = new SweepStaleDocumentsUseCase({
      repository,
      failDocument: new FailDocumentUseCase({ repository, publisher }),
      staleAfterMinutes: 15,
    });

    expect(await sweeper.execute(now)).toBe(1);

    const rows = await pool.query<{ id: string; status: string; error_message: string | null }>(
      'SELECT id, status, error_message FROM documents',
    );
    expect(rows.rows.find((row) => row.id === stale)).toEqual({
      id: stale,
      status: DocumentStatus.ERROR,
      error_message: STALE_INDEXING_REASON,
    });
    expect(rows.rows.find((row) => row.id === fresh)).toMatchObject({ status: DocumentStatus.PROCESSING });
    expect(publisher.events.map((event) => event.id)).toEqual([stale]);
  });

  it('markFailedIfProcessing on an INDEXED row returns false and changes nothing', async () => {
    const id = randomUUID();
    const updatedAt = new Date('2026-03-01T10:00:00.000Z');
    await db.insert(documents).values(
      processingRow(id, updatedAt, { status: DocumentStatus.INDEXED, content: 'texto indexado', updatedAt }),
    );
    const repository = new DrizzleDocumentRepository(db);

    expect(await repository.markFailedIfProcessing(id, 'late failure', new Date())).toBe(false);

    const row = (
      await pool.query<{ status: string; content: string; error_message: string | null; updated_at: Date }>(
        'SELECT status, content, error_message, updated_at FROM documents WHERE id = $1',
        [id],
      )
    ).rows[0];
    expect(row).toEqual({
      status: DocumentStatus.INDEXED,
      content: 'texto indexado',
      error_message: null,
      updated_at: updatedAt,
    });
  });
});
