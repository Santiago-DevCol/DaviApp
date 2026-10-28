export const DocumentStatus = {
  PROCESSING: 'PROCESSING',
  INDEXED: 'INDEXED',
  ERROR: 'ERROR',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export type DocumentFormat = 'txt' | 'md' | 'pdf';

export const ALLOWED_EXTENSIONS: readonly DocumentFormat[] = ['txt', 'md', 'pdf'];

export const ALLOWED_MIME_TYPES: readonly string[] = [
  'text/plain',
  'text/markdown',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface DocumentMetadataInput {
  title: string;
  author: string;
  category: string;
  tags: string[];
  version: string;
}

export interface DocumentSummary extends DocumentMetadataInput {
  id: string;
  format: DocumentFormat;
  fileName: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string | null;
  errorMessage?: string | null;
}

export interface UploadAcceptedItem {
  id: string;
  status: DocumentStatus;
  fileName: string;
}

export interface UploadAcceptedResponse {
  items: UploadAcceptedItem[];
}

export interface SearchResultItem {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  version: string;
  status: DocumentStatus;
  highlight: string;
  rank: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
}

export interface DocumentStatusEvent {
  id: string;
  status: DocumentStatus;
  errorMessage?: string;
  occurredAt: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}
