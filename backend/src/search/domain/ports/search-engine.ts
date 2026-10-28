import { SearchQuery } from '../search-query';
import { SearchPage } from '../search-result';

export interface SearchEngine {
  search(query: SearchQuery): Promise<SearchPage>;
}

export const SEARCH_ENGINE = Symbol('SearchEngine');
