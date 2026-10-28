/**
 * Base class for errors raised by the search domain. Each subclass carries a
 * stable `code` so HTTP adapters can map it without matching on message text.
 */
export abstract class SearchDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidSearchQueryError extends SearchDomainError {
  readonly code = 'INVALID_SEARCH_QUERY';

  constructor(message: string) {
    super(message);
  }
}
