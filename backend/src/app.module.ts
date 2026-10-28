import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { validate } from './shared/config/env.schema';
import { DatabaseModule } from './shared/database/database.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), DatabaseModule, HealthModule],
})
export class AppModule {}
