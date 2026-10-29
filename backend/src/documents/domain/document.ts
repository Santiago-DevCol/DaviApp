import { DocumentFormat, DocumentMetadataInput, DocumentStatus } from '@techdocs/shared';
import { buildDocumentKey } from './document-key';
import { DocumentStateError } from './errors';

export interface DocumentProps {
  id: string;
  fileName: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  version: string;
  /** Normalized title + author; see `buildDocumentKey`. */
  documentKey: string;
  /** SHA-256 (hex) of the uploaded bytes. */
  contentHash: string;
  isLatest: boolean;
  format: DocumentFormat;
  storageKey: string;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  id: string;
  fileName: string;
  metadata: DocumentMetadataInput;
  format: DocumentFormat;
  sizeBytes: number;
  contentHash: string;
  now?: Date;
}

/**
 * Aggregate root of the documents capability. Lifecycle:
 *   PROCESSING -> INDEXED (text extracted and stored)
 *   PROCESSING -> ERROR   (extraction failed, or indexing retries were exhausted)
 * Both end states are terminal.
 *
 * Versioning: documents sharing a `documentKey` form a history; exactly one of
 * them is expected to be `isLatest`. A document is superseded (never deleted)
 * when a newer version of the same key is accepted.
 */
export class Document {
  readonly id: string;
  readonly fileName: string;
  readonly title: string;
  readonly author: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly version: string;
  readonly documentKey: string;
  readonly contentHash: string;
  readonly format: DocumentFormat;
  readonly storageKey: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;

  private _status: DocumentStatus;
  private _errorMessage: string | null;
  private _content: string | null;
  private _isLatest: boolean;
  private _updatedAt: Date;

  constructor(props: DocumentProps) {
    this.id = props.id;
    this.fileName = props.fileName;
    this.title = props.title;
    this.author = props.author;
    this.category = props.category;
    this.tags = [...props.tags];
    this.version = props.version;
    this.documentKey = props.documentKey;
    this.contentHash = props.contentHash;
    this.format = props.format;
    this.storageKey = props.storageKey;
    this.sizeBytes = props.sizeBytes;
    this.createdAt = props.createdAt;
    this._status = props.status;
    this._errorMessage = props.errorMessage;
    this._content = props.content;
    this._isLatest = props.isLatest;
    this._updatedAt = props.updatedAt;
  }

  static create(input: CreateDocumentInput): Document {
    const now = input.now ?? new Date();
    return new Document({
      id: input.id,
      fileName: input.fileName,
      title: input.metadata.title,
      author: input.metadata.author,
      category: input.metadata.category,
      tags: input.metadata.tags,
      version: input.metadata.version,
      documentKey: buildDocumentKey(input.metadata.title, input.metadata.author),
      contentHash: input.contentHash,
      isLatest: true,
      format: input.format,
      storageKey: Document.storageKeyFor(input.id, input.format),
      sizeBytes: input.sizeBytes,
      status: DocumentStatus.PROCESSING,
      errorMessage: null,
      content: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static storageKeyFor(id: string, format: DocumentFormat): string {
    return `${id}.${format}`;
  }

  get status(): DocumentStatus {
    return this._status;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get content(): string | null {
    return this._content;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isLatest(): boolean {
    return this._isLatest;
  }

  /** A newer version of the same document key was accepted; this one stays readable but leaves search. */
  supersede(at: Date = new Date()): void {
    this._isLatest = false;
    this._updatedAt = at;
  }

  isProcessing(): boolean {
    return this._status === DocumentStatus.PROCESSING;
  }

  markIndexed(content: string, at: Date = new Date()): void {
    this.assertTransitionTo(DocumentStatus.INDEXED);
    this._status = DocumentStatus.INDEXED;
    this._content = content;
    this._errorMessage = null;
    this._updatedAt = at;
  }

  /**
   * A failed document never exposes content: whatever was extracted before the
   * failure is dropped so the persisted row carries no half-indexed text.
   */
  markFailed(reason: string, at: Date = new Date()): void {
    this.assertTransitionTo(DocumentStatus.ERROR);
    this._status = DocumentStatus.ERROR;
    this._errorMessage = reason;
    this._content = null;
    this._updatedAt = at;
  }

  private assertTransitionTo(target: DocumentStatus): void {
    if (this._status !== DocumentStatus.PROCESSING) {
      throw new DocumentStateError(this._status, target);
    }
  }
}
