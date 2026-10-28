import type { SearchResponse } from '@techdocs/shared';
import { request } from './client';

export const DEFAULT_PAGE_SIZE = 10;

export interface SearchParams {
  q: string;
  page: number;
  pageSize?: number;
}

export function searchDocuments(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  return request<SearchResponse>('/search', {
    query: { q: params.q, page: params.page, pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE },
    signal,
  });
}
