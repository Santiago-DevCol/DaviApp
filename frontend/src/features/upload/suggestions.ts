import type { DocumentMetadataInput, InspectedFile, MetadataSuggestionSource } from '@techdocs/shared';

export type MetadataField = keyof DocumentMetadataInput;

/** Fields the user edited by hand; a suggestion never replaces them. */
export type TouchedFields = Partial<Record<MetadataField, true>>;

/** Fields whose current value came from the inspection, with its source. */
export type SuggestedFields = Partial<Record<MetadataField, MetadataSuggestionSource>>;

export type InspectionState = 'pending' | 'done' | 'failed' | 'skipped';

export interface SuggestibleEntry {
  metadata: DocumentMetadataInput;
  touched: TouchedFields;
  suggestedFrom: SuggestedFields;
  inspection: InspectionState;
  pages?: number;
}

const SOURCE_HINTS: Record<Exclude<MetadataSuggestionSource, 'none'>, string> = {
  'pdf-info': 'Sugerido desde el PDF',
  'front-matter': 'Sugerido desde el front matter',
  heuristic: 'Sugerido del contenido',
};

/** Hint shown under a prefilled field; `none` yields no hint. */
export function suggestionHint(source: MetadataSuggestionSource | undefined): string | undefined {
  return source && source !== 'none' ? SOURCE_HINTS[source] : undefined;
}

export function formatPages(pages: number): string {
  return pages === 1 ? '1 página' : `${pages} páginas`;
}

function hasValue(value: string | string[] | undefined): value is string | string[] {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;
}

/**
 * Applies the inspection result to an entry. Defaults (file-name title,
 * carried-over author/category/version, empty tags) count as empty and are
 * replaced; anything the user typed is kept.
 */
export function applySuggestion<T extends SuggestibleEntry>(entry: T, item: InspectedFile): T {
  const metadata = { ...entry.metadata };
  const suggestedFrom = { ...entry.suggestedFrom };
  for (const field of ['title', 'author', 'category', 'version', 'tags'] as const) {
    const value = item.suggested[field];
    if (entry.touched[field] || !hasValue(value)) continue;
    if (field === 'tags') metadata.tags = [...(value as string[])];
    else metadata[field] = (value as string).trim();
    if (item.source !== 'none') suggestedFrom[field] = item.source;
  }
  return { ...entry, metadata, suggestedFrom, inspection: 'done', pages: item.pages ?? entry.pages };
}

/** Records a user edit: marks changed fields as touched and drops their suggestion hint. */
export function recordUserEdit<T extends SuggestibleEntry>(entry: T, next: DocumentMetadataInput): T {
  const touched = { ...entry.touched };
  const suggestedFrom = { ...entry.suggestedFrom };
  for (const field of ['title', 'author', 'category', 'version', 'tags'] as const) {
    if (entry.metadata[field] === next[field]) continue;
    touched[field] = true;
    delete suggestedFrom[field];
  }
  return { ...entry, metadata: next, touched, suggestedFrom };
}
