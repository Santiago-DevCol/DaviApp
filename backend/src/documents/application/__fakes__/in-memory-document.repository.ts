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
    return row ? hydrate(row) : null;
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

  async findByKeyAndHash(documentKey: string, contentHash: string): Promise<Document | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.documentKey === documentKey && candidate.contentHash === contentHash,
    );
    return row ? hydrate(row) : null;
  }

  async findLatestByKey(documentKey: string): Promise<Document | null> {
    const row = this.versionsOf(documentKey).find((candidate) => candidate.isLatest);
    return row ? hydrate(row) : null;
  }

  async listVersionsByKey(documentKey: string): Promise<Document[]> {
    return this.versionsOf(documentKey).map(hydrate);
  }

  /** Newest first, with id DESC as a deterministic tiebreaker like the SQL adapter. */
  private versionsOf(documentKey: string): DocumentProps[] {
    return [...this.rows.values()]
      .filter((row) => row.documentKey === documentKey)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
  }

  /** Test helpers. */
  seed(document: Document): void {
    this.rows.set(document.id, snapshot(document));
  }

  get(id: string): Document | undefined {
    const row = this.rows.get(id);
    return row ? hydrate(row) : undefined;
  }

  count(): number {
    return this.rows.size;
  }

  failNextUpdateWith(error: Error): void {
    this.nextUpdateError = error;
  }
}

function hydrate(row: DocumentProps): Document {
  return new Document({ ...row, tags: [...row.tags] });
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
    documentKey: document.documentKey,
    contentHash: document.contentHash,
    isLatest: document.isLatest,
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
