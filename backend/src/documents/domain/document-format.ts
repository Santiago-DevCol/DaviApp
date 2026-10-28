import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, DocumentFormat } from '@techdocs/shared';
import { UnsupportedDocumentFormatError } from './errors';

/**
 * Mime types that browsers and CLIs send when they do not know the real type.
 * They carry no information, so the extension alone decides.
 */
const GENERIC_MIME_TYPES: readonly string[] = ['application/octet-stream', ''];

/**
 * The file extension is authoritative for the format because clients report
 * mime types inconsistently (`.md` arrives as text/plain, text/markdown or
 * application/octet-stream depending on the OS). A mime type that is known and
 * not in the allow-list is still rejected to stop obvious mislabeling.
 */
export function resolveDocumentFormat(fileName: string, mimeType?: string): DocumentFormat {
  const extension = extractExtension(fileName);
  const format = ALLOWED_EXTENSIONS.find((allowed) => allowed === extension);
  if (!format) {
    throw new UnsupportedDocumentFormatError(fileName, mimeType);
  }

  const normalizedMime = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (!GENERIC_MIME_TYPES.includes(normalizedMime) && !ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    throw new UnsupportedDocumentFormatError(fileName, mimeType);
  }

  return format;
}

function extractExtension(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }
  return fileName.slice(dotIndex + 1).toLowerCase();
}
