import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'node:path';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type Database = NodePgDatabase<typeof schema>;

/**
 * Location of the SQL migrations. Resolved relative to this file (not to
 * `process.cwd()`) so it works in every runtime regardless of where the process
 * is launched from:
 *   - start:dev / start:prod → <backend>/dist/shared/database → ../../../drizzle
 *   - ts-node (scripts/migrate.ts) → <backend>/src/shared/database → ../../../drizzle
 */
export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../../drizzle');

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createDatabase(pool: Pool): Database {
  return drizzle(pool, { schema });
}

export async function runMigrations(db: Database, migrationsFolder = MIGRATIONS_FOLDER): Promise<void> {
  await migrate(db, { migrationsFolder });
}
