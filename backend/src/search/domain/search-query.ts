import { InvalidSearchQueryError } from './errors';

export interface SearchQueryInput {
  q: string;
  page?: number;
  pageSize?: number;
}

export const SEARCH_QUERY_LIMITS = {
  maxLength: 200,
  defaultPage: 1,
  defaultPageSize: 10,
  maxPageSize: 50,
} as const;

/**
 * Value object describing one search request. Validation lives here so every
 * adapter (HTTP today, CLI or bench tomorrow) gets the same rules: the text is
 * trimmed and bounded, pagination is bounded to protect the database.
 */
export class SearchQuery {
  private constructor(
    readonly q: string,
    readonly page: number,
    readonly pageSize: number,
  ) {}

  static create(input: SearchQueryInput): SearchQuery {
    const q = (input.q ?? '').trim();
    if (q.length === 0) {
      throw new InvalidSearchQueryError('Search text "q" must not be empty');
    }
    if (q.length > SEARCH_QUERY_LIMITS.maxLength) {
      throw new InvalidSearchQueryError(
        `Search text "q" must be at most ${SEARCH_QUERY_LIMITS.maxLength} characters`,
      );
    }

    const page = input.page ?? SEARCH_QUERY_LIMITS.defaultPage;
    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidSearchQueryError('"page" must be an integer greater than or equal to 1');
    }

    const pageSize = input.pageSize ?? SEARCH_QUERY_LIMITS.defaultPageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > SEARCH_QUERY_LIMITS.maxPageSize) {
      throw new InvalidSearchQueryError(
        `"pageSize" must be an integer between 1 and ${SEARCH_QUERY_LIMITS.maxPageSize}`,
      );
    }

    return new SearchQuery(q, page, pageSize);
  }

  get offset(): number {
    return (this.page - 1) * this.pageSize;
  }
}
