/**
 * Standalone migration runner for CI or manual use:
 *   DATABASE_URL=postgres://... pnpm --filter backend db:migrate
 * The API also applies pending migrations on startup, so this is optional locally.
 */
import { createDatabase, createPool, MIGRATIONS_FOLDER, runMigrations } from '../src/shared/database/database.provider';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPool(connectionString);
  try {
    console.log(`Applying migrations from ${MIGRATIONS_FOLDER}`);
    await runMigrations(createDatabase(pool));
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
