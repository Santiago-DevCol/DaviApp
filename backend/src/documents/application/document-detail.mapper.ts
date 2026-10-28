import { DocumentDetail } from '@techdocs/shared';
import { Document } from '../domain/document';

export function toDocumentDetail(document: Document): DocumentDetail {
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
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
