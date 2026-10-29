import { Document } from '../document';

export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  /** Persists mutable state: status, errorMessage, content, isLatest, updatedAt. */
  update(document: Document): Promise<void>;
  /**
   * Conditional settlement: sets ERROR (clearing content) only if the row is
   * still PROCESSING. Returns whether a row changed, so a concurrent INDEXED
   * write is never overwritten (single statement, no check-then-write race).
   */
  markFailedIfProcessing(id: string, reason: string, at: Date): Promise<boolean>;
  /** PROCESSING documents created before `olderThan`, oldest first. */
  findStaleProcessing(olderThan: Date): Promise<Document[]>;
  /** Subset of `storageKeys` that belong to an existing document row. */
  existsByStorageKeys(storageKeys: string[]): Promise<Set<string>>;
  /** Exact duplicate lookup: same identity and same bytes. */
  findByKeyAndHash(documentKey: string, contentHash: string): Promise<Document | null>;
  findLatestByKey(documentKey: string): Promise<Document | null>;
  /** Every version of the identity, newest first (`createdAt` DESC). */
  listVersionsByKey(documentKey: string): Promise<Document[]>;
}

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');
