import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InspectResponse, MAX_FILE_SIZE_BYTES } from '@techdocs/shared';
import request from 'supertest';
import { HttpExceptionFilter } from '../../../shared/http/http-exception.filter';
import { InspectFilesUseCase } from '../../application/inspect-files.use-case';
import { FormatDispatchingMetadataExtractor } from '../extraction/format-dispatching-metadata.extractor';
import { MarkdownMetadataExtractor } from '../extraction/markdown-metadata.extractor';
import { PdfMetadataExtractor } from '../extraction/pdf-metadata.extractor';
import { TextMetadataExtractor } from '../extraction/text-metadata.extractor';
import { InspectionController } from './inspection.controller';

const SAMPLES_DIR = path.resolve(__dirname, '../../../../../docs/samples');

describe('InspectionController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const useCase = new InspectFilesUseCase({
      extractor: new FormatDispatchingMetadataExtractor(
        new PdfMetadataExtractor(),
        new MarkdownMetadataExtractor(),
        new TextMetadataExtractor(),
      ),
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [InspectionController],
      providers: [{ provide: InspectFilesUseCase, useValue: useCase }],
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

  describe('POST /documents/inspect', () => {
    it('returns 200 with suggestions taken from front matter, PDF info and heuristics', async () => {
      const [manual, spec, guide] = await Promise.all([
        readFile(path.join(SAMPLES_DIR, 'sample-manual.md')),
        readFile(path.join(SAMPLES_DIR, 'sample-spec.txt')),
        readFile(path.join(SAMPLES_DIR, 'sample-guide.pdf')),
      ]);

      const response = await request(app.getHttpServer())
        .post('/documents/inspect')
        .attach('files', manual, { filename: 'sample-manual.md', contentType: 'text/markdown' })
        .attach('files', spec, { filename: 'sample-spec.txt', contentType: 'text/plain' })
        .attach('files', guide, { filename: 'sample-guide.pdf', contentType: 'application/pdf' })
        .expect(200);

      const body = response.body as InspectResponse;
      expect(body.items.map((item) => item.fileName)).toEqual([
        'sample-manual.md',
        'sample-spec.txt',
        'sample-guide.pdf',
      ]);

      const [md, txt, pdf] = body.items;
      expect(md).toMatchObject({
        format: 'md',
        sizeBytes: manual.length,
        source: 'front-matter',
        suggested: {
          title: 'Manual de operación: grúa torre GT-120',
          author: 'Departamento de Equipos Industriales',
          version: '2.1.0',
          category: 'manuals',
          tags: ['crane', 'safety', 'operations'],
        },
      });
      expect(txt).toMatchObject({
        format: 'txt',
        source: 'heuristic',
        suggested: { title: 'TECHNICAL SPECIFICATION: DOCUMENT UPLOAD AND INDEXING API' },
      });
      expect(pdf).toMatchObject({
        format: 'pdf',
        pages: 1,
        source: 'pdf-info',
        suggested: {
          title: 'Deployment Guide: Technical Docs Search API',
          author: 'Platform Engineering',
        },
      });
    });

    it('returns 400 when no file is attached', async () => {
      const response = await request(app.getHttpServer()).post('/documents/inspect').expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, path: '/documents/inspect' });
    });

    it('returns a structured 400 for an unsupported extension', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents/inspect')
        .attach('files', Buffer.from('MZ'), {
          filename: 'tool.exe',
          contentType: 'application/octet-stream',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Unsupported document format for "tool.exe"'),
      });
    });

    it('returns 413 when a file exceeds the size limit', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents/inspect')
        .attach('files', Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 97), {
          filename: 'huge.txt',
          contentType: 'text/plain',
        })
        .expect(413);

      expect(response.body).toMatchObject({ statusCode: 413 });
    });
  });
});
