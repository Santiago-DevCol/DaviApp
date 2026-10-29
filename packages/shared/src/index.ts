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
  /** Identity shared by every version of the same work: normalized title + author. */
  documentKey?: string;
  /** True for the most recent version of its document key. */
  isLatest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionSummary {
  id: string;
  version: string;
  status: DocumentStatus;
  isLatest: boolean;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string | null;
  errorMessage?: string | null;
  /** SHA-256 of the uploaded file bytes; identical bytes are reported as duplicates. */
  contentHash?: string;
  /** Every version sharing this document key, newest first (includes this one). */
  versions?: DocumentVersionSummary[];
}

export interface UploadAcceptedItem {
  id: string;
  status: DocumentStatus;
  fileName: string;
  /** Effective version: the one sent, or an automatic patch bump over the latest version. */
  version?: string;
  /** Present when the same document key already holds identical bytes; nothing was created. */
  duplicateOf?: { id: string; version: string };
}

export interface UploadAcceptedResponse {
  items: UploadAcceptedItem[];
}

/** Where a suggested metadata value came from. */
export type MetadataSuggestionSource = 'pdf-info' | 'front-matter' | 'heuristic' | 'none';

export interface MetadataSuggestion {
  title?: string;
  author?: string;
  category?: string;
  tags?: string[];
  version?: string;
}

/** Result of POST /documents/inspect for one uploaded file; nothing is persisted. */
export interface InspectedFile {
  fileName: string;
  format: DocumentFormat;
  sizeBytes: number;
  pages?: number;
  source: MetadataSuggestionSource;
  suggested: MetadataSuggestion;
}

export interface InspectResponse {
  items: InspectedFile[];
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
