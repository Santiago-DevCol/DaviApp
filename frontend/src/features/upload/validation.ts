import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, type DocumentMetadataInput } from '@techdocs/shared';
import { fileExtension, formatBytes } from '@/lib/format';

export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_TEXT_LENGTH = 200;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

/** Mirrors the backend rules so invalid files are never sent. Returns a Spanish message or null. */
export function validateFile(file: Pick<File, 'name' | 'size'>): string | null {
  const extension = fileExtension(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Formato no permitido (.${extension || '?'}). Solo se aceptan: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`;
  }
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_FILE_SIZE_BYTES)}.`;
  }
  return null;
}

export type MetadataErrors = Partial<Record<keyof DocumentMetadataInput, string>>;

export function validateMetadata(metadata: DocumentMetadataInput): MetadataErrors {
  const errors: MetadataErrors = {};
  for (const field of ['title', 'author', 'category', 'version'] as const) {
    const value = metadata[field].trim();
    if (value.length === 0) errors[field] = 'Campo obligatorio.';
    else if (value.length > MAX_TEXT_LENGTH) errors[field] = `Máximo ${MAX_TEXT_LENGTH} caracteres.`;
  }
  if (metadata.tags.length > MAX_TAGS) {
    errors.tags = `Máximo ${MAX_TAGS} etiquetas.`;
  } else if (metadata.tags.some((tag) => tag.trim().length === 0 || tag.length > MAX_TAG_LENGTH)) {
    errors.tags = `Cada etiqueta debe tener entre 1 y ${MAX_TAG_LENGTH} caracteres.`;
  }
  return errors;
}

export function hasErrors(errors: MetadataErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Trims every field and removes duplicate tags before sending. */
export function normalizeMetadata(metadata: DocumentMetadataInput): DocumentMetadataInput {
  return {
    title: metadata.title.trim(),
    author: metadata.author.trim(),
    category: metadata.category.trim(),
    version: metadata.version.trim(),
    tags: Array.from(new Set(metadata.tags.map((tag) => tag.trim()).filter(Boolean))),
  };
}
