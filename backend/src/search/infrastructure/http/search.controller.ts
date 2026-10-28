import { Controller, Get, Query, Res, UseFilters } from '@nestjs/common';
import type { Response } from 'express';
import { performance } from 'node:perf_hooks';
import {
  SearchDocumentsResponse,
  SearchDocumentsUseCase,
} from '../../application/search-documents.use-case';
import { SearchErrorFilter } from './search-error.filter';
import { SearchQueryDto } from './search-query.dto';

@Controller('search')
@UseFilters(SearchErrorFilter)
export class SearchController {
  constructor(private readonly searchDocuments: SearchDocumentsUseCase) {}

  /**
   * `X-Response-Time` covers the whole handler (validation + engine + mapping)
   * so clients and the bench script can compare it with `tookMs`, which only
   * times the engine call. Results are never cached: the index changes with
   * every upload and the kata wants real latency, not cache hits.
   */
  @Get()
  async search(
    @Query() dto: SearchQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SearchDocumentsResponse> {
    const startedAt = performance.now();
    const result = await this.searchDocuments.execute({
      q: dto.q,
      page: dto.page,
      pageSize: dto.pageSize,
    });
    const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
    response.setHeader('X-Response-Time', `${elapsedMs}ms`);
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }
}
