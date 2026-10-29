import { Inject, Injectable } from '@nestjs/common';
import { DocumentFormat, DocumentStatus } from '@techdocs/shared';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import type { DatabaseClient } from '../../../shared/database/database.provider';
import { DRIZZLE } from '../../../shared/database/database.provider';
import { documents, DocumentRow, NewDocumentRow } from '../../../shared/database/schema';
import { Document } from '../../domain/document';
import { DocumentRepository } from '../../domain/ports/document.repository';

type DocumentRowWithoutVector = Omit<DocumentRow, 'searchVector'>;

@Injectable()
export class DrizzleDocumentRepository implements DocumentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DatabaseClient) {}

  async save(document: Document): Promise<void> {
    await this.db.insert(documents).values(toRow(document));
  }

  async findById(id: string): Promise<Document | null> {
    // The generated tsvector is only useful to PostgreSQL; never pull it over the wire.
    const row = await this.db.query.documents.findFirst({
      where: eq(documents.id, id),
      columns: { searchVector: false },
    });
    return row ? toDomain(row) : null;
  }

  async update(document: Document): Promise<void> {
    await this.db
      .update(documents)
      .set({
        status: document.status,
        errorMessage: document.errorMessage,
        content: document.content,
        isLatest: document.isLatest,
        updatedAt: document.updatedAt,
      })
      .where(eq(documents.id, document.id));
  }

  async markFailedIfProcessing(id: string, reason: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(documents)
      .set({ status: DocumentStatus.ERROR, errorMessage: reason, content: null, updatedAt: at })
      .where(and(eq(documents.id, id), eq(documents.status, DocumentStatus.PROCESSING)))
      .returning({ id: documents.id });
    return updated.length === 1;
  }

  async findStaleProcessing(olderThan: Date): Promise<Document[]> {
    const rows = await this.db.query.documents.findMany({
      where: and(eq(documents.status, DocumentStatus.PROCESSING), lt(documents.createdAt, olderThan)),
      columns: { searchVector: false },
      orderBy: [asc(documents.createdAt), asc(documents.id)],
    });
    return rows.map(toDomain);
  }

  async existsByStorageKeys(storageKeys: string[]): Promise<Set<string>> {
    if (storageKeys.length === 0) {
      return new Set();
    }
    const rows = await this.db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(inArray(documents.storageKey, storageKeys));
    return new Set(rows.map((row) => row.storageKey));
  }

  async findByKeyAndHash(documentKey: string, contentHash: string): Promise<Document | null> {
    const row = await this.db.query.documents.findFirst({
      where: and(eq(documents.documentKey, documentKey), eq(documents.contentHash, contentHash)),
      columns: { searchVector: false },
      orderBy: [desc(documents.createdAt), desc(documents.id)],
    });
    return row ? toDomain(row) : null;
  }

  async findLatestByKey(documentKey: string): Promise<Document | null> {
    const row = await this.db.query.documents.findFirst({
      where: and(eq(documents.documentKey, documentKey), eq(documents.isLatest, true)),
      columns: { searchVector: false },
      // Defensive: two latest rows can exist after concurrent uploads; pick the newest deterministically.
      orderBy: [desc(documents.createdAt), desc(documents.id)],
    });
    return row ? toDomain(row) : null;
  }

  async listVersionsByKey(documentKey: string): Promise<Document[]> {
    const rows = await this.db.query.documents.findMany({
      where: eq(documents.documentKey, documentKey),
      columns: { searchVector: false },
      orderBy: [desc(documents.createdAt), desc(documents.id)],
    });
    return rows.map(toDomain);
  }
}

function toRow(document: Document): NewDocumentRow {
  return {
    id: document.id,
    title: document.title,
    author: document.author,
    category: document.category,
    tags: [...document.tags],
    version: document.version,
    documentKey: document.documentKey,
    contentHash: document.contentHash,
    isLatest: document.isLatest,
    fileName: document.fileName,
    format: document.format,
    storageKey: document.storageKey,
    sizeBytes: document.sizeBytes,
    status: document.status,
    errorMessage: document.errorMessage,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toDomain(row: DocumentRowWithoutVector): Document {
  return new Document({
    id: row.id,
    fileName: row.fileName,
    title: row.title,
    author: row.author,
    category: row.category,
    tags: row.tags,
    version: row.version,
    documentKey: row.documentKey,
    contentHash: row.contentHash,
    isLatest: row.isLatest,
    format: row.format as DocumentFormat,
    storageKey: row.storageKey,
    sizeBytes: row.sizeBytes,
    status: row.status as DocumentStatus,
    errorMessage: row.errorMessage,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
