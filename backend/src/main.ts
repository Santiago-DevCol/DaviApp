import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Env } from './shared/config/env.schema';
import { HttpExceptionFilter } from './shared/http/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }) });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
