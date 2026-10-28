import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DRIZZLE } from '../shared/database/database.provider';

export interface HealthResponse {
  status: 'ok';
  database: 'up' | 'down';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return { status: 'ok', database, timestamp: new Date().toISOString() };
  }
}
