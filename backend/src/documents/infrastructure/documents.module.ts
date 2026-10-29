import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PgBoss } from 'pg-boss';
import { Env } from '../../shared/config/env.schema';
import type { Database } from '../../shared/database/database.provider';
import { DRIZZLE } from '../../shared/database/database.provider';
import { PG_BOSS } from '../../shared/queue/pg-boss.provider';
import { FailDocumentUseCase } from '../application/fail-document.use-case';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { IndexDocumentUseCase } from '../application/index-document.use-case';
import { SweepOrphanFilesUseCase } from '../application/sweep-orphan-files.use-case';
import { SweepStaleDocumentsUseCase } from '../application/sweep-stale-documents.use-case';
import { UploadDocumentsUseCase } from '../application/upload-documents.use-case';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../domain/ports/document.repository';
import { EVENT_PUBLISHER, EventPublisher } from '../domain/ports/event-publisher';
import { FILE_STORAGE, FileStorage } from '../domain/ports/file-storage';
import { ID_GENERATOR, IdGenerator } from '../domain/ports/id-generator';
import { JOB_QUEUE } from '../domain/ports/job-queue';
import { TEXT_EXTRACTOR, TextExtractor } from '../domain/ports/text-extractor';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/ports/unit-of-work';
import { EventEmitterPublisher } from './events/event-emitter.publisher';
import { FileTextExtractor } from './extraction/text-extractor';
import { DocumentsController } from './http/documents.controller';
import { CryptoIdGenerator } from './ids/crypto-id.generator';
import { DrizzleDocumentRepository } from './persistence/drizzle-document.repository';
import { DrizzleUnitOfWork } from './persistence/drizzle-unit-of-work';
import { IndexDocumentWorker } from './queue/index-document.worker';
import { PgBossJobQueue, TransactionalPgBossJobQueue } from './queue/pg-boss-job.queue';
import { LocalFileStorage } from './storage/local-file.storage';
import { StaleDocumentsSweeper, SWEEP_CRON } from './sweeper/stale-documents.sweeper';

/** Files older than this without a `documents` row are deleted by the sweeper. */
const ORPHAN_FILE_MINUTES = 60;

/**
 * Composition root of the documents capability. Use cases are plain classes
 * (no Nest decorators), so they are assembled with factories that receive the
 * adapters bound to each port token.
 */
@Module({
  controllers: [DocumentsController],
  providers: [
    { provide: DOCUMENT_REPOSITORY, useClass: DrizzleDocumentRepository },
    { provide: TEXT_EXTRACTOR, useClass: FileTextExtractor },
    // Kept registered: `onModuleInit` creates the queue before the worker and the unit of work send to it.
    { provide: JOB_QUEUE, useClass: PgBossJobQueue },
    { provide: EVENT_PUBLISHER, useClass: EventEmitterPublisher },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new LocalFileStorage(config.get('STORAGE_DIR', { infer: true })),
    },
    {
      provide: UNIT_OF_WORK,
      inject: [DRIZZLE, PG_BOSS],
      useFactory: (db: Database, boss: PgBoss) =>
        new DrizzleUnitOfWork(db, (txDb) => new TransactionalPgBossJobQueue(boss, txDb)),
    },
    {
      provide: SWEEP_CRON,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => config.get('SWEEP_CRON', { infer: true }),
    },
    {
      provide: UploadDocumentsUseCase,
      inject: [DOCUMENT_REPOSITORY, UNIT_OF_WORK, FILE_STORAGE, ID_GENERATOR, ConfigService],
      useFactory: (
        repository: DocumentRepository,
        unitOfWork: UnitOfWork,
        storage: FileStorage,
        idGenerator: IdGenerator,
        config: ConfigService<Env, true>,
      ) =>
        new UploadDocumentsUseCase({
          repository,
          unitOfWork,
          storage,
          idGenerator,
          maxFileSizeBytes: config.get('MAX_FILE_SIZE_BYTES', { infer: true }),
          logger: new Logger(UploadDocumentsUseCase.name),
        }),
    },
    {
      provide: IndexDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY, FILE_STORAGE, TEXT_EXTRACTOR, EVENT_PUBLISHER],
      useFactory: (
        repository: DocumentRepository,
        storage: FileStorage,
        extractor: TextExtractor,
        publisher: EventPublisher,
      ) =>
        new IndexDocumentUseCase({
          repository,
          storage,
          extractor,
          publisher,
          logger: new Logger(IndexDocumentUseCase.name),
        }),
    },
    {
      provide: FailDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY, EVENT_PUBLISHER],
      useFactory: (repository: DocumentRepository, publisher: EventPublisher) =>
        new FailDocumentUseCase({ repository, publisher }),
    },
    {
      provide: SweepStaleDocumentsUseCase,
      inject: [DOCUMENT_REPOSITORY, FailDocumentUseCase, ConfigService],
      useFactory: (
        repository: DocumentRepository,
        failDocument: FailDocumentUseCase,
        config: ConfigService<Env, true>,
      ) =>
        new SweepStaleDocumentsUseCase({
          repository,
          failDocument,
          staleAfterMinutes: config.get('STALE_PROCESSING_MINUTES', { infer: true }),
          logger: new Logger(SweepStaleDocumentsUseCase.name),
        }),
    },
    {
      provide: SweepOrphanFilesUseCase,
      inject: [DOCUMENT_REPOSITORY, FILE_STORAGE],
      useFactory: (repository: DocumentRepository, storage: FileStorage) =>
        new SweepOrphanFilesUseCase({ repository, storage, orphanAfterMinutes: ORPHAN_FILE_MINUTES }),
    },
    {
      provide: GetDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (repository: DocumentRepository) => new GetDocumentUseCase({ repository }),
    },
    IndexDocumentWorker,
    StaleDocumentsSweeper,
  ],
})
export class DocumentsModule {}
