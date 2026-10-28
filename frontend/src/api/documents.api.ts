import type { DocumentDetail, DocumentMetadataInput, UploadAcceptedResponse } from '@techdocs/shared';
import { request } from './client';

export interface UploadDocumentsInput {
  files: File[];
  /** Aligned by index with `files`. */
  metadata: DocumentMetadataInput[];
}

/**
 * `POST /documents` multipart: repeated `files` parts plus one `metadata`
 * field holding the JSON array aligned with the files. The browser sets the
 * multipart boundary, so no Content-Type header is given.
 */
export function uploadDocuments(input: UploadDocumentsInput): Promise<UploadAcceptedResponse> {
  if (input.files.length !== input.metadata.length) {
    throw new Error('files and metadata must be aligned');
  }
  const form = new FormData();
  for (const file of input.files) form.append('files', file, file.name);
  form.append('metadata', JSON.stringify(input.metadata));
  return request<UploadAcceptedResponse>('/documents', { method: 'POST', body: form });
}

export function getDocument(id: string, signal?: AbortSignal): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/documents/${encodeURIComponent(id)}`, { signal });
}
