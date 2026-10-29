/**
 * Identity shared by every version of the same work. Title and author are
 * normalized (no diacritics, lowercase, trimmed, single spaces) so that
 * "Guía Técnica" and "guia tecnica" group together, while a different title
 * (even a typo) is deliberately a different document.
 *
 * The SQL backfill in `drizzle/0002_*.sql` applies the same normalization with
 * `unaccent`/`lower`/`trim`/`regexp_replace`; the integration suite asserts both
 * sides agree.
 */
export const DOCUMENT_KEY_SEPARATOR = '|';

export function normalizeKeyPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildDocumentKey(title: string, author: string): string {
  return `${normalizeKeyPart(title)}${DOCUMENT_KEY_SEPARATOR}${normalizeKeyPart(author)}`;
}
