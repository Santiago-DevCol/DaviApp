/**
 * Versioning integration suite against a real PostgreSQL (same database
 * selection as `search.integration-spec.ts`: Testcontainers by default,
 * `TEST_DATABASE_URL` as a fallback; the suite truncates `documents`).
 *
 * Covers what unit tests cannot: the SQL backfill of `0002_document_versioning`
 * agreeing with `buildDocumentKey`, the indexes existing after migration, the
 * search engine hiding superseded versions and the upload flow through the real
 * Drizzle repository.
 */
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DocumentStatus } from '@techdocs/shared';
import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { FixedIdGenerator } from '../src/documents/application/__fakes__/fixed-id.generator';
import { InMemoryFileStorage } from '../src/documents/application/__fakes__/in-memory-file.storage';
import { RecordingJobQueue } from '../src/documents/application/__fakes__/recording-job.queue';
import { UploadDocumentsUseCase } from '../src/documents/application/upload-documents.use-case';
import { buildDocumentKey } from '../src/documents/domain/document-key';
import { DrizzleDocumentRepository } from '../src/documents/infrastructure/persistence/drizzle-document.repository';
import { SearchQuery } from '../src/search/domain/search-query';
import { PostgresSearchEngine } from '../src/search/infrastructure/persistence/postgres-search.engine';
import {
  createDatabase,
  createPool,
  Database,
  runMigrations,
} from '../src/shared/database/database.provider';
import { documents, NewDocumentRow } from '../src/shared/database/schema';

const CONTAINER_START_TIMEOUT_MS = 180_000;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function row(overrides: Partial<NewDocumentRow> & { title: string; author: string; content: string }): NewDocumentRow {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.createdAt ?? new Date('2026-03-01T10:00:00.000Z');
  return {
    id,
    category: 'Fixtures',
    tags: ['fixture'],
    version: '1.0.0',
    fileName: `${id}.md`,
    format: 'md',
    storageKey: `${id}.md`,
    sizeBytes: Buffer.byteLength(overrides.content, 'utf8'),
    status: DocumentStatus.INDEXED,
    errorMessage: null,
    documentKey: buildDocumentKey(overrides.title, overrides.author),
    contentHash: sha256(overrides.content),
    isLatest: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('Document versioning (integration)', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool;
  let db: Database;

  beforeAll(async () => {
    let connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      connectionString = container.getConnectionUri();
    }
    pool = createPool(connectionString);
    db = createDatabase(pool);
    await runMigrations(db);
  }, CONTAINER_START_TIMEOUT_MS);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE documents`);
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('creates the versioning indexes', async () => {
    const result = await pool.query<{ indexname: string; indexdef: string }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'documents' ORDER BY indexname",
    );
    const byName = new Map(result.rows.map((r) => [r.indexname, r.indexdef]));

    expect(byName.get('documents_key_latest_idx')).toMatch(/\(document_key\) WHERE is_latest/);
    expect(byName.get('documents_key_hash_idx')).toMatch(/\(document_key, content_hash\)/);
  });

  it('backfills document_key with the same normalization as buildDocumentKey', async () => {
    const cases: Array<[string, string]> = [
      ['Guía Técnica  de Grúas', 'José Pérez'],
      ['  MANUAL de operación\tnivel 2 ', 'Ñandú & Cía.'],
      // Known gap (documented, not covered here): unaccent also folds letters with
      // no combining-mark decomposition (ø, ß, æ) and typographic punctuation (’ -> '),
      // while NFD stripping leaves them untouched. Rare in this corpus.
      ["Ça va: Éléments d'Analyse", 'Sören Ångström'],
    ];
    const ids = cases.map(() => randomUUID());
    await db.insert(documents).values(
      cases.map(([title, author], i) => ({
        ...row({ id: ids[i], title, author, content: `body ${i}` }),
        // Simulate a pre-versioning row: the key is empty until the backfill runs.
        documentKey: '',
      })),
    );

    // Same statement as drizzle/0002_document_versioning.sql.
    await db.execute(sql`
      UPDATE documents
      SET document_key = btrim(regexp_replace(lower(unaccent(title)), '\\s+', ' ', 'g'))
                         || '|' ||
                         btrim(regexp_replace(lower(unaccent(author)), '\\s+', ' ', 'g'))
      WHERE document_key = ''
    `);

    const stored = await pool.query<{ id: string; document_key: string }>(
      'SELECT id, document_key FROM documents',
    );
    const keys = new Map(stored.rows.map((r) => [r.id, r.document_key]));
    cases.forEach(([title, author], i) => {
      expect(keys.get(ids[i])).toBe(buildDocumentKey(title, author));
    });
    expect(keys.get(ids[0])).toBe('guia tecnica de gruas|jose perez');
  });

  it('search returns only the latest version of a document key', async () => {
    const older = row({
      title: 'Ópalo: manual de izaje',
      author: 'Equipo de pruebas',
      content: 'Primera versión del manual de ópalo.',
      version: '1.0.0',
      isLatest: false,
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
    });
    const latest = row({
      title: 'Ópalo: manual de izaje',
      author: 'Equipo de pruebas',
      content: 'Segunda versión del manual de ópalo, corregida.',
      version: '1.0.1',
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
    });
    await db.insert(documents).values([older, latest]);
    const engine = new PostgresSearchEngine(db);

    const page = await engine.search(SearchQuery.create({ q: 'ópalo', page: 1, pageSize: 10 }));
    expect(page.total).toBe(1);
    expect(page.items.map((hit) => hit.id)).toEqual([latest.id]);

    // The count fallback (page beyond the last) applies the same filter.
    const beyond = await engine.search(SearchQuery.create({ q: 'ópalo', page: 2, pageSize: 10 }));
    expect(beyond).toEqual({ items: [], total: 1 });
  });

  it('upload through the real repository: duplicate creates no row, new bytes create a superseding version', async () => {
    const repository = new DrizzleDocumentRepository(db);
    const queue = new RecordingJobQueue();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const useCase = new UploadDocumentsUseCase({
      repository,
      storage: new InMemoryFileStorage(),
      queue,
      idGenerator: new FixedIdGenerator(ids),
    });
    const metadata = (version: string) => ({
      title: 'Manual de Grúa',
      author: 'Ana Torres',
      category: 'manuals',
      tags: ['crane'],
      version,
    });
    const upload = (fileName: string, text: string, version: string) => {
      const buffer = Buffer.from(text, 'utf8');
      return useCase.execute({
        files: [{ fileName, mimeType: 'text/plain', sizeBytes: buffer.byteLength, buffer }],
        metadata: [metadata(version)],
      });
    };

    const first = await upload('v1.txt', 'contenido original', '1.0.0');
    expect(first.items[0]).toMatchObject({ id: ids[0], version: '1.0.0' });

    const duplicate = await upload('again.txt', 'contenido original', '3.0.0');
    expect(duplicate.items[0]).toEqual({
      id: ids[0],
      status: DocumentStatus.PROCESSING,
      fileName: 'again.txt',
      version: '1.0.0',
      duplicateOf: { id: ids[0], version: '1.0.0' },
    });

    const newVersion = await upload('v2.txt', 'contenido corregido', '1.0.0');
    expect(newVersion.items[0]).toMatchObject({ id: ids[1], version: '1.0.1' });

    const rows = await pool.query<{ id: string; version: string; is_latest: boolean; document_key: string }>(
      'SELECT id, version, is_latest, document_key FROM documents ORDER BY created_at, id',
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.document_key === 'manual de grua|ana torres')).toBe(true);
    expect(rows.rows.find((r) => r.id === ids[0])).toMatchObject({ version: '1.0.0', is_latest: false });
    expect(rows.rows.find((r) => r.id === ids[1])).toMatchObject({ version: '1.0.1', is_latest: true });
    expect(queue.enqueued).toEqual([ids[0], ids[1]]);

    const versions = await repository.listVersionsByKey('manual de grua|ana torres');
    expect(versions.map((d) => d.id)).toEqual([ids[1], ids[0]]);
    expect(await repository.findLatestByKey('manual de grua|ana torres')).toMatchObject({ id: ids[1] });
    expect(await repository.findByKeyAndHash('manual de grua|ana torres', sha256('contenido original'))).toMatchObject({
      id: ids[0],
    });
  });
});
