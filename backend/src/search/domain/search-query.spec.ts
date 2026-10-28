import { InvalidSearchQueryError } from './errors';
import { SearchQuery } from './search-query';

describe('SearchQuery', () => {
  it('trims the text and applies the default page and page size', () => {
    const query = SearchQuery.create({ q: '  grúa torre  ' });

    expect(query.q).toBe('grúa torre');
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(10);
    expect(query.offset).toBe(0);
  });

  it('computes the offset from page and page size', () => {
    const query = SearchQuery.create({ q: 'kubernetes', page: 3, pageSize: 25 });

    expect(query.offset).toBe(50);
  });

  it.each(['', '   ', 'x'.repeat(201)])('rejects an empty or oversized query (%j)', (q) => {
    expect(() => SearchQuery.create({ q })).toThrow(InvalidSearchQueryError);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects an invalid page (%p)', (page) => {
    expect(() => SearchQuery.create({ q: 'ok', page })).toThrow(InvalidSearchQueryError);
  });

  it.each([10_001, 1e30])('rejects a page above the 10 000 cap (%p)', (page) => {
    expect(() => SearchQuery.create({ q: 'ok', page })).toThrow(InvalidSearchQueryError);
  });

  it('accepts the page cap (10 000)', () => {
    expect(SearchQuery.create({ q: 'ok', page: 10_000 }).page).toBe(10_000);
  });

  it('strips NUL bytes from the text (Postgres rejects them)', () => {
    expect(SearchQuery.create({ q: 'gr\u0000úa\u0000' }).q).toBe('grúa');
  });

  it('rejects a text that is empty once NUL bytes are stripped', () => {
    expect(() => SearchQuery.create({ q: '\u0000 \u0000' })).toThrow(InvalidSearchQueryError);
  });

  it.each([0, 51, 2.5])('rejects a page size outside 1..50 (%p)', (pageSize) => {
    expect(() => SearchQuery.create({ q: 'ok', pageSize })).toThrow(InvalidSearchQueryError);
  });

  it('accepts the bounds (200 chars, page size 50)', () => {
    const query = SearchQuery.create({ q: 'y'.repeat(200), pageSize: 50 });

    expect(query.q).toHaveLength(200);
    expect(query.pageSize).toBe(50);
  });

  it('exposes a stable error code on the domain error', () => {
    try {
      SearchQuery.create({ q: '' });
      fail('expected InvalidSearchQueryError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSearchQueryError);
      expect((error as InvalidSearchQueryError).code).toBe('INVALID_SEARCH_QUERY');
    }
  });
});
