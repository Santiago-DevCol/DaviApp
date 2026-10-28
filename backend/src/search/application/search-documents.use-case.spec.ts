import { InvalidSearchQueryError } from '../domain/errors';
import { SearchHit } from '../domain/search-result';
import { FakeSearchEngine } from './__fakes__/fake-search.engine';
import { SearchDocumentsUseCase } from './search-documents.use-case';

function hit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Manual de grúa torre',
    author: 'Ana Torres',
    category: 'Grúas y equipos',
    tags: ['grúa', 'izaje'],
    version: '1.0.0',
    status: 'INDEXED',
    fileName: 'manual.md',
    highlight: 'la <mark>grúa</mark> torre',
    rank: 0.42,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SearchDocumentsUseCase', () => {
  let engine: FakeSearchEngine;
  let useCase: SearchDocumentsUseCase;

  beforeEach(() => {
    engine = new FakeSearchEngine();
    useCase = new SearchDocumentsUseCase({ engine });
  });

  it('applies page and page size defaults and forwards the trimmed query', async () => {
    engine.respondWith({ items: [hit()], total: 1 });

    const response = await useCase.execute({ q: '  grúa  ' });

    expect(engine.queries).toHaveLength(1);
    expect(engine.queries[0]).toMatchObject({ q: 'grúa', page: 1, pageSize: 10, offset: 0 });
    expect(response).toMatchObject({ page: 1, pageSize: 10, total: 1 });
  });

  it('maps hits to the shared SearchResultItem contract with ISO dates', async () => {
    engine.respondWith({ items: [hit()], total: 1 });

    const response = await useCase.execute({ q: 'grúa' });

    expect(response.items).toEqual([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Manual de grúa torre',
        author: 'Ana Torres',
        category: 'Grúas y equipos',
        tags: ['grúa', 'izaje'],
        version: '1.0.0',
        status: 'INDEXED',
        fileName: 'manual.md',
        highlight: 'la <mark>grúa</mark> torre',
        rank: 0.42,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('passes explicit page and page size through to the engine', async () => {
    engine.respondWith({ items: [], total: 120 });

    const response = await useCase.execute({ q: 'kubernetes', page: 4, pageSize: 25 });

    expect(engine.queries[0]).toMatchObject({ page: 4, pageSize: 25, offset: 75 });
    expect(response).toMatchObject({ page: 4, pageSize: 25, total: 120, items: [] });
  });

  it('reports a non-negative tookMs measured around the engine call', async () => {
    engine.respondWith({ items: [], total: 0 }, { delayMs: 5 });

    const response = await useCase.execute({ q: 'latencia' });

    expect(response.tookMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(response.tookMs)).toBe(true);
  });

  it('returns an empty page untouched when the engine finds nothing', async () => {
    engine.respondWith({ items: [], total: 0 });

    const response = await useCase.execute({ q: 'nada' });

    expect(response.items).toEqual([]);
    expect(response.total).toBe(0);
  });

  it('rejects an invalid query before calling the engine', async () => {
    await expect(useCase.execute({ q: '   ' })).rejects.toBeInstanceOf(InvalidSearchQueryError);
    await expect(useCase.execute({ q: 'ok', pageSize: 500 })).rejects.toBeInstanceOf(
      InvalidSearchQueryError,
    );
    expect(engine.queries).toHaveLength(0);
  });
});
