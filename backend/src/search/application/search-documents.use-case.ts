import { SearchResponse, SearchResultItem } from '@techdocs/shared';
import { performance } from 'node:perf_hooks';
import { SearchEngine } from '../domain/ports/search-engine';
import { SearchQuery, SearchQueryInput } from '../domain/search-query';
import { SearchHit } from '../domain/search-result';

export interface SearchDocumentsDependencies {
  engine: SearchEngine;
}

/**
 * Superset of the shared `SearchResultItem`: `fileName` and `createdAt` are
 * useful to the UI (open the viewer, show recency) and cost nothing to return.
 * Declared here to keep the shared contract untouched; promote them to
 * `@techdocs/shared` once the frontend consumes them.
 */
export interface SearchResultItemDetail extends SearchResultItem {
  fileName: string;
  createdAt: string;
}

export interface SearchDocumentsResponse extends SearchResponse {
  items: SearchResultItemDetail[];
}

/**
 * HU-02: validates the request, runs it through the engine and reports how
 * long the engine took (`tookMs`). The timing is measured here, around the
 * port call, so it reflects the search itself and not HTTP overhead.
 */
export class SearchDocumentsUseCase {
  private readonly engine: SearchEngine;

  constructor(deps: SearchDocumentsDependencies) {
    this.engine = deps.engine;
  }

  async execute(input: SearchQueryInput): Promise<SearchDocumentsResponse> {
    const query = SearchQuery.create(input);

    const startedAt = performance.now();
    const page = await this.engine.search(query);
    const tookMs = Math.round((performance.now() - startedAt) * 100) / 100;

    return {
      items: page.items.map(toResultItem),
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      tookMs,
    };
  }
}

function toResultItem(hit: SearchHit): SearchResultItemDetail {
  return {
    id: hit.id,
    title: hit.title,
    author: hit.author,
    category: hit.category,
    tags: [...hit.tags],
    version: hit.version,
    status: hit.status,
    fileName: hit.fileName,
    highlight: hit.highlight,
    rank: hit.rank,
    createdAt: hit.createdAt.toISOString(),
  };
}
