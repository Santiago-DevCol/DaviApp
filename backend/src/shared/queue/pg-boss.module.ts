import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PgBoss } from 'pg-boss';
import { Env } from '../config/env.schema';
import { createPgBoss, PG_BOSS, stopPgBoss } from './pg-boss.provider';

@Global()
@Module({
  providers: [
    {
      provide: PG_BOSS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createPgBoss(config.get('DATABASE_URL', { infer: true })),
    },
  ],
  exports: [PG_BOSS],
})
export class PgBossModule implements OnModuleDestroy {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onModuleDestroy(): Promise<void> {
    await stopPgBoss(this.boss);
  }
}
