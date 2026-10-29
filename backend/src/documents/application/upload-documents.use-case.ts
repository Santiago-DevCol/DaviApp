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
import { JobQueue } from '../domain/ports/job-queue';
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

export interface UploadDocumentsDependencies {
  repository: DocumentRepository;
  storage: FileStorage;
  queue: JobQueue;
  idGenerator: IdGenerator;
  maxFileSizeBytes?: number;
}

const ENQUEUE_FAILURE_REASON = 'Failed to enqueue indexing job';
const SUPERSEDE_FAILURE_REASON = 'Failed to supersede previous version';

interface ValidatedUpload {
  file: UploadFileInput;
  metadata: DocumentMetadataInput;
  format: DocumentFormat;
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
 *      rollback). The effective version never goes backwards: the sent version
 *      is kept when greater than the latest one, otherwise the latest gets a
 *      patch bump; the previous latest is superseded (readable, hidden from search).
 *   3. new identity -> new document, latest by definition.
 * `DocumentRepository.findByKeyAndHash` (and its index) is intentionally kept
 * but no longer drives this decision.
 * Known limit: two concurrent uploads of the same identity are not serialized,
 * so both may end up `isLatest` (roadmap: advisory lock on the key).
 */
export class UploadDocumentsUseCase {
  private readonly repository: DocumentRepository;
  private readonly storage: FileStorage;
  private readonly queue: JobQueue;
  private readonly idGenerator: IdGenerator;
  private readonly maxFileSizeBytes: number;

  constructor(deps: UploadDocumentsDependencies) {
    this.repository = deps.repository;
    this.storage = deps.storage;
    this.queue = deps.queue;
    this.idGenerator = deps.idGenerator;
    this.maxFileSizeBytes = deps.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
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

    const previousLatest = await this.repository.findLatestByKey(documentKey);
    if (previousLatest && isDuplicateOf(previousLatest, contentHash)) {
      return {
        id: previousLatest.id,
        status: previousLatest.status,
        fileName: upload.file.fileName,
        version: previousLatest.version,
        duplicateOf: { id: previousLatest.id, version: previousLatest.version },
      };
    }

    const version = resolveEffectiveVersion(upload.metadata.version, previousLatest?.version);
    const document = Document.create({
      id: this.idGenerator.next(),
      fileName: upload.file.fileName,
      metadata: { ...upload.metadata, version },
      format: upload.format,
      sizeBytes: upload.file.sizeBytes,
      contentHash,
    });

    await this.storage.save(document.storageKey, upload.file.buffer);
    await this.repository.save(document);

    // From here on the row exists: any failure leaves a visible ERROR trace
    // instead of a document stuck in PROCESSING.
    if (previousLatest) {
      // Only after the new row exists, so a failed insert never leaves the key without a latest version.
      previousLatest.supersede();
      await this.failDocumentOnError(document, SUPERSEDE_FAILURE_REASON, () =>
        this.repository.update(previousLatest),
      );
    }
    await this.failDocumentOnError(document, ENQUEUE_FAILURE_REASON, () =>
      this.queue.enqueueIndexDocument(document.id),
    );

    return {
      id: document.id,
      status: document.status,
      fileName: document.fileName,
      version: document.version,
    };
  }

  private async failDocumentOnError(document: Document, reason: string, step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (error) {
      document.markFailed(reason);
      await this.repository.update(document);
      throw error;
    }
  }
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

/** Rule 2: a sent version only wins when it is strictly greater than the latest one. */
function resolveEffectiveVersion(sent: string, latest: string | undefined): string {
  if (latest === undefined || compareVersions(sent, latest) > 0) {
    return sent;
  }
  return bumpPatch(latest);
}
