import { DocumentDetail, DocumentVersionSummary } from '@techdocs/shared';
import { Document } from '../domain/document';

export function toDocumentVersionSummary(document: Document): DocumentVersionSummary {
  return {
    id: document.id,
    version: document.version,
    status: document.status,
    isLatest: document.isLatest,
    createdAt: document.createdAt.toISOString(),
  };
}

/** `versions` is every document sharing the key, newest first, including `document` itself. */
export function toDocumentDetail(document: Document, versions: readonly Document[]): DocumentDetail {
  return {
    id: document.id,
    title: document.title,
    author: document.author,
    category: document.category,
    tags: [...document.tags],
    version: document.version,
    format: document.format,
    fileName: document.fileName,
    sizeBytes: document.sizeBytes,
    status: document.status,
    errorMessage: document.errorMessage,
    content: document.content,
    documentKey: document.documentKey,
    contentHash: document.contentHash,
    isLatest: document.isLatest,
    versions: versions.map(toDocumentVersionSummary),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
