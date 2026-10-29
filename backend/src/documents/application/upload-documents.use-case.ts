import {
  DocumentFormat,
  DocumentMetadataInput,
  DocumentStatus,
  MAX_FILE_SIZE_BYTES,
  UploadAcceptedItem,
  UploadAcceptedResponse,
} from '@techdocs/shared';
import { createHash } from 'node:crypto';
import { Document } from '../domain/document';
import { buildDocumentKey } from '../domain/document-key';
import { resolveDocumentFormat } from '../domain/document-format';
import { FileTooLargeError, InvalidUploadBatchError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { FileStorage } from '../domain/ports/file-storage';
import { IdGenerator } from '../domain/ports/id-generator';
import { TransactionContext, UnitOfWork } from '../domain/ports/unit-of-work';
import { bumpPatch, compareVersions } from '../domain/semver';

export interface UploadFileInput {
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
  buffer: Buffer;
}

export interface UploadDocumentsInput {
  files: UploadFileInput[];
  /** Aligned by index with `files`. */
  metadata: DocumentMetadataInput[];
}

export interface UploadLogger {
  warn(message: string): void;
}

export interface UploadDocumentsDependencies {
  /** Non-transactional reads (duplicate fast path before any side effect). */
  repository: DocumentRepository;
  unitOfWork: UnitOfWork;
  storage: FileStorage;
  idGenerator: IdGenerator;
  maxFileSizeBytes?: number;
  logger?: UploadLogger;
}

interface ValidatedUpload {
  file: UploadFileInput;
  metadata: DocumentMetadataInput;
  format: DocumentFormat;
}

interface UploadIdentity {
  id: string;
  documentKey: string;
  contentHash: string;
}

/**
 * HU-01 step 1: accept the batch, persist each document as PROCESSING and hand
 * the heavy work (text extraction) to a durable job. The whole batch is
 * validated before any side effect so a single bad file rejects the request
 * without leaving half-written state behind.
 *
 * Versioning rules, per file (identity = `documentKey`, fingerprint = SHA-256
 * of the uploaded bytes). Only the current latest version of the identity is
 * consulted; older superseded rows never influence the decision:
 *   1. latest version has the same bytes and is not ERROR -> duplicate: nothing
 *      is created, the item points at that document (`duplicateOf`). Bulk
 *      retries are idempotent.
 *   2. otherwise, same identity -> new version. This covers other bytes, the
 *      same bytes as an ERROR latest (retry after a failed indexing) and the same
 *      bytes as an older superseded version (re-uploading old bytes is a
 *      rollback). The effective version never goes backwards (see
 *      `resolveEffectiveVersion`); the previous latest is superseded (readable,
 *      hidden from search).
 *   3. new identity -> new document, latest by definition.
 * `DocumentRepository.findByKeyAndHash` (and its index) is intentionally kept
 * but no longer drives this decision.
 *
 * Effect order, per file: the bytes are written to storage first (outside any
 * transaction, idempotent by `storageKey`); then one unit of work takes a
 * per-key lock, re-reads the latest version under that lock (so two concurrent
 * uploads of the same identity are serialized and exactly one stays latest),
 * inserts the row, supersedes the previous latest and enqueues the indexing
 * job. Either all of that commits or none of it does, so a row never exists
 * without its job. When the unit of work fails the stored file is deleted on a
 * best-effort basis; a file left behind by a crash between the two steps is
 * removed later by the orphan sweeper.
 */
export class UploadDocumentsUseCase {
  private readonly repository: DocumentRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly storage: FileStorage;
  private readonly idGenerator: IdGenerator;
  private readonly maxFileSizeBytes: number;
  private readonly logger: UploadLogger;

  constructor(deps: UploadDocumentsDependencies) {
    this.repository = deps.repository;
    this.unitOfWork = deps.unitOfWork;
    this.storage = deps.storage;
    this.idGenerator = deps.idGenerator;
    this.maxFileSizeBytes = deps.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
    this.logger = deps.logger ?? { warn: () => undefined };
  }

  async execute(input: UploadDocumentsInput): Promise<UploadAcceptedResponse> {
    const uploads = this.validate(input);

    const items: UploadAcceptedItem[] = [];
    for (const upload of uploads) {
      items.push(await this.accept(upload));
    }
    return { items };
  }

  private validate(input: UploadDocumentsInput): ValidatedUpload[] {
    if (input.files.length === 0) {
      throw new InvalidUploadBatchError('At least one file is required');
    }
    if (input.files.length !== input.metadata.length) {
      throw new InvalidUploadBatchError(
        `Received ${input.files.length} file(s) but ${input.metadata.length} metadata entry(ies)`,
      );
    }

    return input.files.map((file, index) => {
      const format = resolveDocumentFormat(file.fileName, file.mimeType);
      if (file.sizeBytes > this.maxFileSizeBytes) {
        throw new FileTooLargeError(file.fileName, file.sizeBytes, this.maxFileSizeBytes);
      }
      return { file, metadata: input.metadata[index], format };
    });
  }

  private async accept(upload: ValidatedUpload): Promise<UploadAcceptedItem> {
    const documentKey = buildDocumentKey(upload.metadata.title, upload.metadata.author);
    const contentHash = sha256(upload.file.buffer);

    // Fast path: an obvious duplicate costs no file write and no transaction.
    // The decision is taken again under the lock below, which is the one that counts.
    const seen = await this.repository.findLatestByKey(documentKey);
    if (seen && isDuplicateOf(seen, contentHash)) {
      return duplicateItem(seen, upload.file.fileName);
    }

    const id = this.idGenerator.next();
    const storageKey = Document.storageKeyFor(id, upload.format);
    await this.storage.save(storageKey, upload.file.buffer);

    let outcome: UploadAcceptedItem;
    try {
      outcome = await this.unitOfWork.run((ctx) =>
        this.acceptUnderLock(ctx, upload, { id, documentKey, contentHash }),
      );
    } catch (error) {
      await this.deleteQuietly(storageKey);
      throw error;
    }
    if (outcome.duplicateOf) {
      // A concurrent upload of the same bytes won the lock; our row was never written.
      await this.deleteQuietly(storageKey);
    }
    return outcome;
  }

  private async acceptUnderLock(
    ctx: TransactionContext,
    upload: ValidatedUpload,
    identity: UploadIdentity,
  ): Promise<UploadAcceptedItem> {
    await ctx.lockDocumentKey(identity.documentKey);

    const previousLatest = await ctx.repository.findLatestByKey(identity.documentKey);
    if (previousLatest && isDuplicateOf(previousLatest, identity.contentHash)) {
      return duplicateItem(previousLatest, upload.file.fileName);
    }

    const version = resolveEffectiveVersion(upload.metadata.version, previousLatest?.version);
    const document = Document.create({
      id: identity.id,
      fileName: upload.file.fileName,
      metadata: { ...upload.metadata, version },
      format: upload.format,
      sizeBytes: upload.file.sizeBytes,
      contentHash: identity.contentHash,
    });

    await ctx.repository.save(document);
    if (previousLatest) {
      previousLatest.supersede();
      await ctx.repository.update(previousLatest);
    }
    await ctx.queue.enqueueIndexDocument(document.id);

    return {
      id: document.id,
      status: document.status,
      fileName: document.fileName,
      version: document.version,
    };
  }

  private async deleteQuietly(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not delete ${storageKey} after a failed upload; the orphan sweeper will retry: ${detail}`,
      );
    }
  }
}

function duplicateItem(latest: Document, fileName: string): UploadAcceptedItem {
  return {
    id: latest.id,
    status: latest.status,
    fileName,
    version: latest.version,
    duplicateOf: { id: latest.id, version: latest.version },
  };
}

/**
 * Rule 1: a duplicate is the current latest version with the same bytes, unless
 * that version failed (ERROR), in which case the upload is a legitimate retry.
 */
function isDuplicateOf(latest: Document, contentHash: string): boolean {
  return latest.contentHash === contentHash && latest.status !== DocumentStatus.ERROR;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Rule 2: `effective = max(sent, bumpPatch(latest))`, so the version never goes
 * backwards. The sent string is kept verbatim when it wins (`v2.0.0` stays
 * `v2.0.0`); an unparsable sent version sorts below everything and an
 * unparsable latest core counts as `0.0.0`. The first version of an identity is
 * always whatever was sent.
 */
function resolveEffectiveVersion(sent: string, latest: string | undefined): string {
  if (latest === undefined) {
    return sent;
  }
  const bumped = bumpPatch(latest);
  return compareVersions(sent, bumped) >= 0 ? sent : bumped;
}
