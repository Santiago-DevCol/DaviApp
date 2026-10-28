export const queryKeys = {
  documents: ['document'] as const,
  document: (id: string) => ['document', id] as const,
  searches: ['search'] as const,
  search: (q: string, page: number, pageSize: number) => ['search', { q, page, pageSize }] as const,
};
