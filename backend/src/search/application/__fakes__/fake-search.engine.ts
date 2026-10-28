import { SearchEngine } from '../../domain/ports/search-engine';
import { SearchQuery } from '../../domain/search-query';
import { SearchPage } from '../../domain/search-result';

export class FakeSearchEngine implements SearchEngine {
  readonly queries: SearchQuery[] = [];
  private page: SearchPage = { items: [], total: 0 };
  private delayMs = 0;

  respondWith(page: SearchPage, options: { delayMs?: number } = {}): void {
    this.page = page;
    this.delayMs = options.delayMs ?? 0;
  }

  async search(query: SearchQuery): Promise<SearchPage> {
    this.queries.push(query);
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return this.page;
  }
}
