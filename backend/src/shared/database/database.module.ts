import { Global, Inject, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Env } from '../config/env.schema';
import { describeError, errorStackFrames } from '../errors/error-details';
import {
  createDatabase,
  createPool,
  DRIZZLE,
  MIGRATIONS_FOLDER,
  runMigrations,
} from './database.provider';
import type { Database } from './database.provider';

const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createPool(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => createDatabase(pool),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {
    this.pool.on('error', (error) => {
      this.logger.error(
        `Idle PostgreSQL client error: ${describeError(error)}`,
        errorStackFrames(error),
      );
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Applying migrations from ${MIGRATIONS_FOLDER}`);
    await runMigrations(this.db);
    this.logger.log('Migrations applied');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
