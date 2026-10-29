import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../shared/config/env.schema';
import { FailDocumentUseCase } from '../application/fail-document.use-case';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { IndexDocumentUseCase } from '../application/index-document.use-case';
import { UploadDocumentsUseCase } from '../application/upload-documents.use-case';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../domain/ports/document.repository';
import { EVENT_PUBLISHER, EventPublisher } from '../domain/ports/event-publisher';
import { FILE_STORAGE, FileStorage } from '../domain/ports/file-storage';
import { ID_GENERATOR, IdGenerator } from '../domain/ports/id-generator';
import { JOB_QUEUE, JobQueue } from '../domain/ports/job-queue';
import { TEXT_EXTRACTOR, TextExtractor } from '../domain/ports/text-extractor';
import { EventEmitterPublisher } from './events/event-emitter.publisher';
import { FileTextExtractor } from './extraction/text-extractor';
import { DocumentsController } from './http/documents.controller';
import { CryptoIdGenerator } from './ids/crypto-id.generator';
import { DrizzleDocumentRepository } from './persistence/drizzle-document.repository';
import { IndexDocumentWorker } from './queue/index-document.worker';
import { PgBossJobQueue } from './queue/pg-boss-job.queue';
import { LocalFileStorage } from './storage/local-file.storage';

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
      provide: UploadDocumentsUseCase,
      inject: [DOCUMENT_REPOSITORY, FILE_STORAGE, JOB_QUEUE, ID_GENERATOR, ConfigService],
      useFactory: (
        repository: DocumentRepository,
        storage: FileStorage,
        queue: JobQueue,
        idGenerator: IdGenerator,
        config: ConfigService<Env, true>,
      ) =>
        new UploadDocumentsUseCase({
          repository,
          storage,
          queue,
          idGenerator,
          maxFileSizeBytes: config.get('MAX_FILE_SIZE_BYTES', { infer: true }),
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
      provide: GetDocumentUseCase,
      inject: [DOCUMENT_REPOSITORY],
      useFactory: (repository: DocumentRepository) => new GetDocumentUseCase({ repository }),
    },
    IndexDocumentWorker,
  ],
})
export class DocumentsModule {}
