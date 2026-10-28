import { Logger } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

export const PG_BOSS = Symbol('PG_BOSS');

/** pg-boss keeps its own tables in a dedicated schema, apart from the app's `public` tables. */
export const PG_BOSS_SCHEMA = 'pgboss';

/**
 * Creates and starts a pg-boss instance. Starting here (instead of in a
 * lifecycle hook) guarantees every consumer receives a ready queue regardless
 * of module initialization order, and makes a broken DATABASE_URL fail boot.
 */
export async function createPgBoss(connectionString: string, logger = new Logger('PgBoss')): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    schema: PG_BOSS_SCHEMA,
    application_name: 'techdocs-api',
  });

  // An unhandled 'error' event would crash the process; surface it through the app logger instead.
  boss.on('error', (error: Error) => logger.error(error.message, error.stack));
  boss.on('warning', (warning) => logger.warn(JSON.stringify(warning)));

  await boss.start();
  logger.log(`pg-boss started (schema "${PG_BOSS_SCHEMA}")`);
  return boss;
}

export async function stopPgBoss(boss: PgBoss, logger = new Logger('PgBoss')): Promise<void> {
  await boss.stop({ graceful: true, timeout: 10_000 });
  logger.log('pg-boss stopped');
}
