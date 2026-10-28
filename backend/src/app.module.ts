import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DocumentsModule } from './documents/infrastructure/documents.module';
import { HealthModule } from './health/health.module';
import { validate } from './shared/config/env.schema';
import { DatabaseModule } from './shared/database/database.module';
import { PgBossModule } from './shared/queue/pg-boss.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    PgBossModule,
    HealthModule,
    DocumentsModule,
  ],
})
export class AppModule {}
