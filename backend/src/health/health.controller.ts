import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import type { Database } from '../shared/database/database.provider';
import { DRIZZLE } from '../shared/database/database.provider';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  timestamp: string;
}

/**
 * Liveness + dependency check. A failing database probe answers 503 so load
 * balancers and `docker compose` health checks stop routing to the instance,
 * while the body still says which dependency is down.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }

    const status: HealthResponse['status'] = database === 'up' ? 'ok' : 'degraded';
    response.status(status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status, database, timestamp: new Date().toISOString() };
  }
}
