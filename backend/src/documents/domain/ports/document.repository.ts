import { Document } from '../document';

export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  /** Persists mutable state: status, errorMessage, content, isLatest, updatedAt. */
  update(document: Document): Promise<void>;
  /** Exact duplicate lookup: same identity and same bytes. */
  findByKeyAndHash(documentKey: string, contentHash: string): Promise<Document | null>;
  findLatestByKey(documentKey: string): Promise<Document | null>;
  /** Every version of the identity, newest first (`createdAt` DESC). */
  listVersionsByKey(documentKey: string): Promise<Document[]>;
}

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');
