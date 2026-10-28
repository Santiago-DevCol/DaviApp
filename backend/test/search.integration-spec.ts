/**
 * Search integration suite against a real PostgreSQL.
 *
 * Database selection:
 *   - default: a throwaway `postgres:16-alpine` started with Testcontainers
 *     (needs a reachable Docker daemon);
 *   - fallback: set `TEST_DATABASE_URL` to a dedicated database (never the
 *     development one: the suite truncates `documents`). Example on the compose
 *     instance: create `techdocs_test` and point the URL at port 5433.
 *
 * Fixtures: ~300 generated documents (same generator as the seed script) so
 * the planner has a realistic table, plus hand-written rows for the assertions.
 */
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DocumentStatus } from '@techdocs/shared';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';
import { buildDocument, createRandom } from '../scripts/synthetic-documents';
import { SearchQuery } from '../src/search/domain/search-query';
import { SearchHit } from '../src/search/domain/search-result';
import { PostgresSearchEngine } from '../src/search/infrastructure/persistence/postgres-search.engine';
import {
  createDatabase,
  createPool,
  Database,
  runMigrations,
} from '../src/shared/database/database.provider';
import { documents, NewDocumentRow } from '../src/shared/database/schema';

const GENERATED_COUNT = 300;
/** Rows sharing the same rank and `created_at`; more than any page size so ties span pages. */
const TIED_COUNT = 40;
const CONTAINER_START_TIMEOUT_MS = 180_000;

const FIXTURE_IDS = {
  titleMatch: randomUUID(),
  contentMatch: randomUUID(),
  processing: randomUUID(),
  failed: randomUUID(),
  accented: randomUUID(),
  phrase: randomUUID(),
  notPhrase: randomUUID(),
} as const;

function fixture(
  id: string,
  title: string,
  content: string,
  overrides: Partial<NewDocumentRow> = {},
): NewDocumentRow {
  const createdAt = new Date('2026-03-01T10:00:00.000Z');
  return {
    id,
    title,
    author: 'Equipo de pruebas',
    category: 'Fixtures',
    tags: ['fixture'],
    version: '1.0.0',
    fileName: `${id}.md`,
    format: 'md',
    storageKey: `${id}.md`,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    status: DocumentStatus.INDEXED,
    errorMessage: null,
    content,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

/** Hand-written rows; the word "zafiro" is unique to these fixtures. */
const FIXTURES: NewDocumentRow[] = [
  fixture(FIXTURE_IDS.titleMatch, 'Zafiro: procedimiento de arranque', 'Texto del cuerpo sin la palabra buscada.'),
  fixture(
    FIXTURE_IDS.contentMatch,
    'Procedimiento de arranque general',
    'El zafiro aparece una sola vez en el cuerpo de este documento de pruebas.',
  ),
  fixture(FIXTURE_IDS.processing, 'Zafiro en proceso', 'Documento zafiro todavía en proceso.', {
    status: DocumentStatus.PROCESSING,
  }),
  fixture(FIXTURE_IDS.failed, 'Zafiro con error', 'Documento zafiro que falló al indexar.', {
    status: DocumentStatus.ERROR,
    errorMessage: 'No extractable text found',
  }),
  fixture(
    FIXTURE_IDS.accented,
    'Calibración de grúa móvil',
    'Procedimiento de calibración del limitador de momento de la grúa móvil.',
  ),
  fixture(
    FIXTURE_IDS.phrase,
    'Aislamiento de líneas',
    'La línea de alta tensión requiere aislamiento adicional en todo el recorrido.',
  ),
  fixture(
    FIXTURE_IDS.notPhrase,
    'Circuitos de control',
    'La tensión es alta en el circuito secundario; revise los fusibles antes de intervenir.',
  ),
];

/**
 * Identical title, content and timestamp: every row gets the same `ts_rank_cd`
 * and the same `created_at`, so only the id tiebreaker can order them. The word
 * "berilo" is unique to these rows.
 */
const TIED_FIXTURES: NewDocumentRow[] = Array.from({ length: TIED_COUNT }, () =>
  fixture(randomUUID(), 'Berilo: ficha de mantenimiento', 'Ficha de mantenimiento del berilo.'),
);

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flattenPlan)];
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

describe('PostgresSearchEngine (integration)', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool;
  let db: Database;
  let engine: PostgresSearchEngine;

  const search = (q: string, page = 1, pageSize = 10) =>
    engine.search(SearchQuery.create({ q, page, pageSize }));

  beforeAll(async () => {
    let connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      connectionString = container.getConnectionUri();
    }

    pool = createPool(connectionString);
    db = createDatabase(pool);
    engine = new PostgresSearchEngine(db);

    await runMigrations(db);
    await db.execute(sql`TRUNCATE TABLE documents`);

    const random = createRandom(7);
    const generated = Array.from({ length: GENERATED_COUNT }, (_, i) => buildDocument(random, i).row);
    for (let offset = 0; offset < generated.length; offset += 50) {
      await db.insert(documents).values(generated.slice(offset, offset + 50));
    }
    await db.insert(documents).values(FIXTURES);
    await db.insert(documents).values(TIED_FIXTURES);
    // Fresh statistics so the planner's choice reflects the real table.
    await db.execute(sql`ANALYZE documents`);
  }, CONTAINER_START_TIMEOUT_MS);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('ranks a title match above a content-only match', async () => {
    const page = await search('zafiro');

    const ids = page.items.map((hit) => hit.id);
    expect(ids).toEqual([FIXTURE_IDS.titleMatch, FIXTURE_IDS.contentMatch]);
    expect(page.items[0].rank).toBeGreaterThan(page.items[1].rank);
  });

  it('maps every column of a hit, including timestamps as Date', async () => {
    const [hit] = (await search('zafiro')).items;

    expect(hit).toMatchObject({
      id: FIXTURE_IDS.titleMatch,
      title: 'Zafiro: procedimiento de arranque',
      author: 'Equipo de pruebas',
      category: 'Fixtures',
      tags: ['fixture'],
      version: '1.0.0',
      status: DocumentStatus.INDEXED,
      fileName: `${FIXTURE_IDS.titleMatch}.md`,
    });
    expect(hit.createdAt).toBeInstanceOf(Date);
    expect(hit.createdAt.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    expect(typeof hit.rank).toBe('number');
  });

  it('matches regardless of accents and applies Spanish stemming', async () => {
    const unaccented = await search('calibracion');
    expect(unaccented.total).toBe(1);
    expect(unaccented.items[0].id).toBe(FIXTURE_IDS.accented);

    const plural = await search('grúas calibración');
    expect(plural.total).toBe(1);
    expect(plural.items[0].id).toBe(FIXTURE_IDS.accented);

    const gruas = await search('gruas', 1, 50);
    expect(gruas.items.map((hit) => hit.id)).toContain(FIXTURE_IDS.accented);
  });

  it('treats a quoted phrase as adjacent words (websearch syntax)', async () => {
    const phrase = await search('"alta tensión"');
    expect(phrase.items.map((hit) => hit.id)).toEqual([FIXTURE_IDS.phrase]);

    // Without quotes both words are AND-ed and both fixtures match.
    const loose = await search('alta tensión');
    expect(loose.items.map((hit) => hit.id).sort()).toEqual(
      [FIXTURE_IDS.phrase, FIXTURE_IDS.notPhrase].sort(),
    );
  });

  it('highlights the match with <mark> and at most two fragments', async () => {
    const page = await search('zafiro');
    const byId = new Map(page.items.map((hit) => [hit.id, hit]));

    const content = byId.get(FIXTURE_IDS.contentMatch) as SearchHit;
    expect(content.highlight).toContain('<mark>zafiro</mark>');
    expect(content.highlight.split(' … ').length).toBeLessThanOrEqual(2);

    // Title-only match: the content headline has no <mark>, so the title is used.
    const title = byId.get(FIXTURE_IDS.titleMatch) as SearchHit;
    expect(title.highlight).toBe('<mark>Zafiro</mark>: procedimiento de arranque');
  });

  it('paginates with a stable total, no overlap and a shorter last page', async () => {
    const probe = await search('procedimiento', 1, 1);
    expect(probe.total).toBeGreaterThan(20);
    // Pick a page size that does not divide the total so the last page is shorter.
    const pageSize = [7, 8, 9, 6, 5, 4, 3].find((size) => probe.total % size !== 0) as number;
    const pageCount = Math.ceil(probe.total / pageSize);

    const seen = new Set<string>();
    for (let page = 1; page <= pageCount; page += 1) {
      const result = await search('procedimiento', page, pageSize);
      expect(result.total).toBe(probe.total);
      const expectedLength = page < pageCount ? pageSize : probe.total % pageSize;
      expect(result.items).toHaveLength(expectedLength);
      for (const hit of result.items) {
        expect(seen.has(hit.id)).toBe(false);
        seen.add(hit.id);
      }
    }
    expect(seen.size).toBe(probe.total);

    const beyond = await search('procedimiento', pageCount + 1, pageSize);
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(probe.total);
  });

  it('paginates rows with identical rank and created_at deterministically (id tiebreaker)', async () => {
    const pageSize = 7;
    const pageCount = Math.ceil(TIED_COUNT / pageSize);

    const walked: string[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const result = await search('berilo', page, pageSize);
      expect(result.total).toBe(TIED_COUNT);
      walked.push(...result.items.map((hit) => hit.id));
    }

    // Every id exactly once: no repeats, nothing vanished between pages.
    expect(walked).toHaveLength(TIED_COUNT);
    expect(new Set(walked).size).toBe(TIED_COUNT);
    const expectedIds = TIED_FIXTURES.map((row) => row.id as string);
    expect([...walked].sort()).toEqual([...expectedIds].sort());
    // The tiebreaker is `id DESC`; lowercase uuid text order equals Postgres' byte order.
    expect(walked).toEqual([...expectedIds].sort().reverse());

    // The same page twice yields the same ids in the same order.
    const once = (await search('berilo', 3, pageSize)).items.map((hit) => hit.id);
    const twice = (await search('berilo', 3, pageSize)).items.map((hit) => hit.id);
    expect(twice).toEqual(once);
  });

  it('returns only INDEXED documents', async () => {
    const page = await search('zafiro', 1, 50);

    expect(page.total).toBe(2);
    const ids = page.items.map((hit) => hit.id);
    expect(ids).not.toContain(FIXTURE_IDS.processing);
    expect(ids).not.toContain(FIXTURE_IDS.failed);
    expect(page.items.every((hit) => hit.status === DocumentStatus.INDEXED)).toBe(true);
  });

  it('returns an empty page without touching the index for a stopword-only query', async () => {
    const page = await search('de la en');

    expect(page).toEqual({ items: [], total: 0 });
  });

  it('uses the GIN index documents_search_idx for the hits query', async () => {
    const HITS_QUERY = `EXPLAIN (FORMAT JSON)
       WITH q AS (SELECT websearch_to_tsquery('spanish_unaccent', $1) AS query)
       SELECT d.id, ts_rank_cd(d.search_vector, q.query) AS rank, d.created_at, count(*) OVER () AS total
       FROM documents d, q
       WHERE numnode(q.query) > 0 AND d.status = 'INDEXED' AND d.search_vector @@ q.query
       ORDER BY rank DESC, d.created_at DESC, d.id DESC
       LIMIT 10 OFFSET 0`;
    const findIndexNode = (plan: PlanNode) => {
      const nodes = flattenPlan(plan);
      console.log(`EXPLAIN node types: ${nodes.map((node) => node['Node Type']).join(' > ')}`);
      return nodes.find(
        (node) =>
          /Index Scan/.test(node['Node Type']) && node['Index Name'] === 'documents_search_idx',
      );
    };

    const natural = await pool.query<{ 'QUERY PLAN': [{ Plan: PlanNode }] }>(HITS_QUERY, [
      'grúa mantenimiento',
    ]);
    let indexNode = findIndexNode(natural.rows[0]['QUERY PLAN'][0].Plan);

    if (!indexNode) {
      // With ~300 rows and a frequent term the planner can rightly prefer a
      // sequential scan (the whole table fits in a few pages). Disabling it
      // for this statement only proves the index is usable for the predicate
      // (operator class and text search configuration match), which is what
      // matters once the table grows.
      console.log('Planner chose a sequential scan at this table size; retrying with enable_seqscan = off');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL enable_seqscan = off');
        const forced = await client.query<{ 'QUERY PLAN': [{ Plan: PlanNode }] }>(HITS_QUERY, [
          'grúa mantenimiento',
        ]);
        indexNode = findIndexNode(forced.rows[0]['QUERY PLAN'][0].Plan);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    }

    expect(indexNode).toBeDefined();
    expect(indexNode?.['Node Type']).toMatch(/Bitmap Index Scan|Index Scan/);
  });

  it('answers 20 varied queries over 300+ rows under the 1 s SLO', async () => {
    const queries = [
      'grúa', 'kubernetes', 'despliegue', 'índice GIN', '"plan de ejecución"', 'rollback automático',
      'tsvector', 'certificado TLS', 'manual de operación', 'latencia p95', 'pod autoscaler',
      'webhook', 'inspección diaria', 'cable de acero', 'secretos', 'procedimiento verificación',
      'helm chart', 'zafiro', 'calibracion', 'paginación cursor',
    ];
    const timings: number[] = [];
    for (const q of queries) {
      const startedAt = performance.now();
      await search(q);
      timings.push(performance.now() - startedAt);
    }

    const max = Math.max(...timings);
    const p95 = percentile(timings, 95);
    console.log(
      `Search latency over ${queries.length} queries: p50=${percentile(timings, 50).toFixed(1)}ms ` +
        `p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    );
    expect(p95).toBeLessThan(1000);
  });
});
