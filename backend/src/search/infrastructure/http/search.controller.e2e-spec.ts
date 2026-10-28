import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../../../shared/http/http-exception.filter';
import { FakeSearchEngine } from '../../application/__fakes__/fake-search.engine';
import { SearchDocumentsUseCase } from '../../application/search-documents.use-case';
import { SearchController } from './search.controller';

describe('SearchController (e2e)', () => {
  let app: INestApplication;
  let engine: FakeSearchEngine;

  beforeAll(async () => {
    engine = new FakeSearchEngine();
    const useCase = new SearchDocumentsUseCase({ engine });

    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchDocumentsUseCase, useValue: useCase }],
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

  it('returns the SearchResponse shape and the X-Response-Time header', async () => {
    engine.respondWith({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Despliegue en Kubernetes',
          author: 'Ana Torres',
          category: 'Kubernetes',
          tags: ['k8s'],
          version: '1.0.0',
          status: 'INDEXED',
          fileName: 'despliegue.md',
          highlight: 'el <mark>despliegue</mark> blue-green',
          rank: 0.6,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      total: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'kubernetes despliegue', page: '2', pageSize: '5' })
      .expect(200);

    expect(response.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 5,
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Despliegue en Kubernetes',
          highlight: 'el <mark>despliegue</mark> blue-green',
          rank: 0.6,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(typeof response.body.tookMs).toBe('number');
    // Query params arrive as strings; the DTO must coerce them before the use case.
    expect(engine.queries.at(-1)).toMatchObject({ q: 'kubernetes despliegue', page: 2, pageSize: 5 });
  });

  it('returns 400 with the shared error body when q is missing', async () => {
    const response = await request(app.getHttpServer()).get('/search').expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      path: '/search',
    });
    expect(response.body.details).toEqual(expect.arrayContaining([expect.stringContaining('q')]));
  });

  it('returns 400 when q is blank after trimming (domain rule)', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: '   ' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.stringContaining('"q"'),
    });
  });

  it('returns 400 when pageSize exceeds the domain limit', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'ok', pageSize: '500' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.stringContaining('pageSize'),
    });
  });

  it('returns 400 when page is not an integer', async () => {
    await request(app.getHttpServer()).get('/search').query({ q: 'ok', page: 'abc' }).expect(400);
  });

  it.each(['10001', '1e30'])('returns 400 when page exceeds the cap (%s)', async (page) => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'ok', page })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(JSON.stringify(response.body)).toContain('page');
  });

  it('strips NUL bytes from q before reaching the engine', async () => {
    await request(app.getHttpServer()).get('/search').query({ q: 'gr\u0000ua' }).expect(200);

    expect(engine.queries.at(-1)).toMatchObject({ q: 'grua' });
  });

  it('returns 400 when q contains only NUL bytes', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: '\u0000' })
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400, message: expect.stringContaining('"q"') });
  });

  it('rejects unknown query parameters', async () => {
    await request(app.getHttpServer()).get('/search').query({ q: 'ok', sort: 'date' }).expect(400);
  });
});
