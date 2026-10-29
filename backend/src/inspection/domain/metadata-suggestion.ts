import type { MetadataSuggestion, MetadataSuggestionSource } from '@techdocs/shared';

/** Same limits as `UploadDocumentMetadataDto`, so a suggestion is always submittable as-is. */
export const MAX_FIELD_LENGTH = 200;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

/**
 * What an extractor found in one file.
 *
 * `source` describes where the suggestion came from:
 * - `pdf-info` / `front-matter`: explicit metadata embedded by the author.
 * - `heuristic`: derived from the content itself (an H1, the first line).
 * - `none`: nothing usable in the content. `suggested.title` may still be
 *   filled from the file name (see `titleFromFileName`); that fallback never
 *   upgrades the source because it tells the user the title is a guess.
 */
export interface MetadataInspection {
  source: MetadataSuggestionSource;
  suggested: MetadataSuggestion;
  /** Page count; only PDFs report it and only when the file could be parsed. */
  pages?: number;
}

/** Loosely typed input: YAML and PDF dictionaries hand back arbitrary values. */
export interface RawSuggestion {
  title?: unknown;
  author?: unknown;
  category?: unknown;
  tags?: unknown;
  version?: unknown;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalizes raw values into a `MetadataSuggestion` the upload form accepts:
 * trimmed, without control characters, cut to the DTO limits, and without
 * empty entries. Non-string scalars are stringified (YAML parses `2.1` as a
 * number); objects and arrays in scalar fields are ignored.
 */
export function sanitizeSuggestion(raw: RawSuggestion): MetadataSuggestion {
  const suggestion: MetadataSuggestion = {};

  const title = sanitizeScalar(raw.title);
  if (title) suggestion.title = title;
  const author = sanitizeScalar(raw.author);
  if (author) suggestion.author = author;
  const category = sanitizeScalar(raw.category);
  if (category) suggestion.category = category;
  const version = sanitizeScalar(raw.version);
  if (version) suggestion.version = version;

  const tags = sanitizeTags(raw.tags);
  if (tags.length > 0) suggestion.tags = tags;

  return suggestion;
}

/**
 * Human-readable fallback title: extension removed, `_`/`-` turned into
 * spaces, whitespace collapsed. `undefined` when nothing remains (empty or
 * dot-file names).
 */
export function titleFromFileName(fileName: string): string | undefined {
  const base = fileName.trim();
  const dotIndex = base.lastIndexOf('.');
  const stem = dotIndex >= 0 ? base.slice(0, dotIndex) : base;
  const title = cleanText(stem.replace(/[_-]+/g, ' '));
  return title.length > 0 ? title.slice(0, MAX_FIELD_LENGTH) : undefined;
}

/** The inspection returned when the content yields nothing: `source: 'none'`, title from the file name. */
export function fileNameFallback(fileName: string, pages?: number): MetadataInspection {
  const title = titleFromFileName(fileName);
  return {
    source: 'none',
    suggested: title ? { title } : {},
    ...(pages !== undefined ? { pages } : {}),
  };
}

function sanitizeScalar(value: unknown): string | undefined {
  const text = scalarToString(value);
  if (text === undefined) return undefined;
  const cleaned = cleanText(text);
  return cleaned.length > 0 ? cleaned.slice(0, MAX_FIELD_LENGTH) : undefined;
}

function sanitizeTags(value: unknown): string[] {
  const candidates: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const tags: string[] = [];
  for (const candidate of candidates) {
    const text = scalarToString(candidate);
    if (text === undefined) continue;
    const tag = cleanText(text).slice(0, MAX_TAG_LENGTH);
    if (tag.length > 0 && !tags.includes(tag)) {
      tags.push(tag);
    }
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

function scalarToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function cleanText(text: string): string {
  return text.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
}
