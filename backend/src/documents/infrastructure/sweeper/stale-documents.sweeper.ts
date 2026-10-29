import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { describeError, errorStackFrames } from '../../../shared/errors/error-details';
import { PG_BOSS } from '../../../shared/queue/pg-boss.provider';
import { SweepOrphanFilesUseCase } from '../../application/sweep-orphan-files.use-case';
import { SweepStaleDocumentsUseCase } from '../../application/sweep-stale-documents.use-case';

export const SWEEP_QUEUE = 'sweep-stale-documents';
export const SWEEP_CRON = Symbol('SWEEP_CRON');

/**
 * Periodic safety net, scheduled through pg-boss rather than a Nest
 * `@Interval`: the cron row lives in the database, so with several API
 * replicas exactly one job per tick is created and processed once, instead of
 * every replica sweeping at the same time. The queue is a singleton (one
 * pending/active sweep at a time), so a slow sweep never piles up. The handler
 * runs both sweeps and reports the counts; errors are logged and the job is
 * left to the next tick (no retries: the next occurrence is the retry).
 */
@Injectable()
export class StaleDocumentsSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleDocumentsSweeper.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    @Inject(SWEEP_CRON) private readonly cron: string,
    private readonly sweepStaleDocuments: SweepStaleDocumentsUseCase,
    private readonly sweepOrphanFiles: SweepOrphanFilesUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.createQueue(SWEEP_QUEUE, { policy: 'singleton', retryLimit: 0 });
    await this.boss.schedule(SWEEP_QUEUE, this.cron);
    await this.boss.work(SWEEP_QUEUE, async () => {
      await this.sweep();
    });
    this.logger.log(`Stale document sweeper scheduled on "${SWEEP_QUEUE}" (${this.cron})`);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.boss.offWork(SWEEP_QUEUE);
    } catch {
      // The boss may already be stopped; nothing left to unregister.
    }
  }

  async sweep(now = new Date()): Promise<void> {
    try {
      const settled = await this.sweepStaleDocuments.execute(now);
      const deleted = await this.sweepOrphanFiles.execute(now);
      if (settled > 0 || deleted > 0) {
        this.logger.warn(`Sweep settled ${settled} stale document(s) and deleted ${deleted} orphan file(s)`);
      } else {
        this.logger.debug('Sweep found nothing to clean');
      }
    } catch (error) {
      this.logger.error(`Sweep failed: ${describeError(error)}`, errorStackFrames(error));
    }
  }
}
