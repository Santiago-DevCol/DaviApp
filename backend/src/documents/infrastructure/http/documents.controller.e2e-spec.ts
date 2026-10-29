import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentStatus } from '@techdocs/shared';
import request from 'supertest';
import { HttpExceptionFilter } from '../../../shared/http/http-exception.filter';
import { FIXTURE_IDS, processingDocument } from '../../application/__fakes__/document.fixture';
import { FakeUnitOfWork } from '../../application/__fakes__/fake-unit-of-work';
import { FixedIdGenerator } from '../../application/__fakes__/fixed-id.generator';
import { InMemoryDocumentRepository } from '../../application/__fakes__/in-memory-document.repository';
import { InMemoryFileStorage } from '../../application/__fakes__/in-memory-file.storage';
import { RecordingJobQueue } from '../../application/__fakes__/recording-job.queue';
import { GetDocumentUseCase } from '../../application/get-document.use-case';
import { UploadDocumentsUseCase } from '../../application/upload-documents.use-case';
import { DocumentsController } from './documents.controller';

/** Third id handed out by the generator; FIXTURE_IDS[2] must stay unknown for the GET 404 case. */
const ACCENTED_UPLOAD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const validMetadata = (title: string) => ({
  title,
  author: 'Ana Torres',
  category: 'manuals',
  tags: ['crane'],
  version: '1.0.0',
});

describe('DocumentsController (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryDocumentRepository;
  let queue: RecordingJobQueue;

  beforeAll(async () => {
    repository = new InMemoryDocumentRepository();
    queue = new RecordingJobQueue();
    const uploadDocuments = new UploadDocumentsUseCase({
      repository,
      unitOfWork: new FakeUnitOfWork(repository, queue),
      storage: new InMemoryFileStorage(),
      idGenerator: new FixedIdGenerator([FIXTURE_IDS[0], FIXTURE_IDS[1], ACCENTED_UPLOAD_ID]),
    });
    const getDocument = new GetDocumentUseCase({ repository });

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: UploadDocumentsUseCase, useValue: uploadDocuments },
        { provide: GetDocumentUseCase, useValue: getDocument },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same global setup as main.ts so the error contract is exercised end to end.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /documents', () => {
    it('accepts a multi-file upload with 202 and returns one tracking item per file', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('Manual'), validMetadata('Spec')]))
        .attach('files', Buffer.from('# Manual'), { filename: 'manual.md', contentType: 'text/markdown' })
        .attach('files', Buffer.from('Spec body'), { filename: 'spec.txt', contentType: 'text/plain' })
        .expect(202);

      expect(response.body).toEqual({
        items: [
          { id: FIXTURE_IDS[0], status: DocumentStatus.PROCESSING, fileName: 'manual.md', version: '1.0.0' },
          { id: FIXTURE_IDS[1], status: DocumentStatus.PROCESSING, fileName: 'spec.txt', version: '1.0.0' },
        ],
      });
      expect(queue.enqueued).toEqual([FIXTURE_IDS[0], FIXTURE_IDS[1]]);
    });

    it('keeps accented file names intact (multipart names are decoded as UTF-8)', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('Guía')]))
        .attach('files', Buffer.from('Contenido'), {
          filename: 'Guía técnica.txt',
          contentType: 'text/plain',
        })
        .expect(202);

      expect(response.body).toEqual({
        items: [
          { id: ACCENTED_UPLOAD_ID, status: DocumentStatus.PROCESSING, fileName: 'Guía técnica.txt', version: '1.0.0' },
        ],
      });
    });

    it('reports a re-upload of identical bytes as duplicateOf the existing document (still 202)', async () => {
      const jobsBefore = queue.enqueued.length;

      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('Manual')]))
        .attach('files', Buffer.from('# Manual'), { filename: 'manual-copy.md', contentType: 'text/markdown' })
        .expect(202);

      expect(response.body).toEqual({
        items: [
          {
            id: FIXTURE_IDS[0],
            status: DocumentStatus.PROCESSING,
            fileName: 'manual-copy.md',
            version: '1.0.0',
            duplicateOf: { id: FIXTURE_IDS[0], version: '1.0.0' },
          },
        ],
      });
      expect(queue.enqueued).toHaveLength(jobsBefore);
    });

    it('returns a structured 400 when metadata is not a JSON array', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', '{not json')
        .attach('files', Buffer.from('x'), { filename: 'a.md' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.stringContaining('JSON array'),
        path: '/documents',
      });
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('returns 400 with per-field details when a metadata entry is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([{ ...validMetadata('x'), title: '', tags: 'nope', extra: 1 }]))
        .attach('files', Buffer.from('x'), { filename: 'a.md' })
        .expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining('metadata[0].title'),
          expect.stringContaining('metadata[0].tags'),
          expect.stringContaining('metadata[0].property extra'),
        ]),
      );
    });

    it('rejects a disallowed extension with 400 and persists nothing', async () => {
      const before = repository.count();

      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('bad')]))
        .attach('files', Buffer.from('MZ'), { filename: 'tool.exe', contentType: 'application/octet-stream' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.stringContaining('tool.exe'),
      });
      expect(repository.count()).toBe(before);
    });

    it('returns 400 when no file is attached', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('x')]))
        .expect(400);

      expect(response.body.message).toMatch(/files/);
    });

    it('returns 400 when files and metadata entries are not aligned', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .field('metadata', JSON.stringify([validMetadata('only one')]))
        .attach('files', Buffer.from('a'), { filename: 'a.md' })
        .attach('files', Buffer.from('b'), { filename: 'b.md' })
        .expect(400);

      expect(response.body.message).toMatch(/2 file\(s\).*1 metadata/);
    });
  });

  describe('GET /documents/:id', () => {
    it('returns 404 with the shared error body for an unknown id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/documents/${FIXTURE_IDS[2]}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Document ${FIXTURE_IDS[2]} not found`,
        path: `/documents/${FIXTURE_IDS[2]}`,
      });
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer()).get('/documents/not-a-uuid').expect(400);
    });

    it('returns the document detail for a known id', async () => {
      const document = processingDocument({ id: FIXTURE_IDS[2], format: 'txt', fileName: 'spec.txt' });
      document.markIndexed('Spec body');
      repository.seed(document);

      const response = await request(app.getHttpServer())
        .get(`/documents/${FIXTURE_IDS[2]}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: FIXTURE_IDS[2],
        fileName: 'spec.txt',
        status: DocumentStatus.INDEXED,
        content: 'Spec body',
        documentKey: 'crane manual|ana torres',
        isLatest: true,
        versions: [{ id: FIXTURE_IDS[2], version: '1.0.0', status: DocumentStatus.INDEXED, isLatest: true }],
      });
    });
  });
});
