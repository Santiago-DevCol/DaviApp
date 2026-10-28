/**
 * Seeds synthetic technical documents for demos and search latency measurements.
 *
 *   pnpm --filter backend db:seed                      # 300 documents, appended
 *   pnpm --filter backend db:seed -- --count 1000      # custom amount
 *   pnpm --filter backend db:seed -- --reset           # TRUNCATE documents first
 *
 * Rows are inserted straight through Drizzle as INDEXED (the generated
 * `search_vector` column indexes them on insert) and the matching `.md`/`.txt`
 * file is written to STORAGE_DIR so the viewer works for seeded documents too.
 * `--reset` only truncates the table; files left in STORAGE_DIR are harmless.
 * Content is generated from a seeded PRNG, so repeated runs are reproducible.
 */
import { count, sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { createDatabase, createPool, runMigrations } from '../src/shared/database/database.provider';
import { documents } from '../src/shared/database/schema';
import { buildDocument, createRandom } from './synthetic-documents';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const { values } = parseArgs({
    // pnpm forwards the `--` separator literally (`db:seed -- --count 300`); drop it.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      count: { type: 'string', default: '300' },
      reset: { type: 'boolean', default: false },
      seed: { type: 'string', default: '42' },
    },
  });
  const total = Number.parseInt(values.count, 10);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`--count must be a positive integer, received "${values.count}"`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required (set it in backend/.env or the environment)');
  }
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? './storage');
  await mkdir(storageDir, { recursive: true });

  const pool = createPool(connectionString);
  const db = createDatabase(pool);
  try {
    await runMigrations(db);

    if (values.reset) {
      await db.execute(sql`TRUNCATE TABLE documents`);
      console.log('Truncated documents');
    }

    const random = createRandom(Number.parseInt(values.seed, 10) || 42);
    const batchSize = 50;
    const startedAt = Date.now();
    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, total - offset) }, (_, i) =>
        buildDocument(random, offset + i),
      );
      await Promise.all(
        batch.map((doc) => writeFile(path.join(storageDir, doc.row.storageKey), doc.fileContent, 'utf8')),
      );
      await db.insert(documents).values(batch.map((doc) => doc.row));
      console.log(`Inserted ${Math.min(offset + batchSize, total)}/${total}`);
    }

    const [{ rows }] = await db.select({ rows: count() }).from(documents);
    console.log(
      `Seeded ${total} documents in ${Date.now() - startedAt}ms; documents table now has ${rows} rows (files under ${storageDir})`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
