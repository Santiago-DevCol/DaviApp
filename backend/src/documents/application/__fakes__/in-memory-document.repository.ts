import { Document, DocumentProps } from '../../domain/document';
import { DocumentRepository } from '../../domain/ports/document.repository';

/**
 * Stores snapshots (not references) so a test can only observe state that was
 * explicitly persisted through `save`/`update`, exactly like a real database.
 */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly rows = new Map<string, DocumentProps>();
  private nextUpdateError: Error | null = null;

  async save(document: Document): Promise<void> {
    if (this.rows.has(document.id)) {
      throw new Error(`duplicate key: ${document.id}`);
    }
    this.rows.set(document.id, snapshot(document));
  }

  async findById(id: string): Promise<Document | null> {
    const row = this.rows.get(id);
    return row ? new Document({ ...row, tags: [...row.tags] }) : null;
  }

  async update(document: Document): Promise<void> {
    if (this.nextUpdateError) {
      const error = this.nextUpdateError;
      this.nextUpdateError = null;
      throw error;
    }
    if (!this.rows.has(document.id)) {
      throw new Error(`cannot update missing document ${document.id}`);
    }
    this.rows.set(document.id, snapshot(document));
  }

  /** Test helpers. */
  seed(document: Document): void {
    this.rows.set(document.id, snapshot(document));
  }

  get(id: string): Document | undefined {
    const row = this.rows.get(id);
    return row ? new Document({ ...row, tags: [...row.tags] }) : undefined;
  }

  count(): number {
    return this.rows.size;
  }

  failNextUpdateWith(error: Error): void {
    this.nextUpdateError = error;
  }
}

function snapshot(document: Document): DocumentProps {
  return {
    id: document.id,
    fileName: document.fileName,
    title: document.title,
    author: document.author,
    category: document.category,
    tags: [...document.tags],
    version: document.version,
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
