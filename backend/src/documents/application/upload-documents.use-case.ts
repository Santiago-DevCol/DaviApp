import {
  DocumentFormat,
  DocumentMetadataInput,
  MAX_FILE_SIZE_BYTES,
  UploadAcceptedItem,
  UploadAcceptedResponse,
} from '@techdocs/shared';
import { Document } from '../domain/document';
import { resolveDocumentFormat } from '../domain/document-format';
import { FileTooLargeError, InvalidUploadBatchError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { FileStorage } from '../domain/ports/file-storage';
import { IdGenerator } from '../domain/ports/id-generator';
import { JobQueue } from '../domain/ports/job-queue';

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
    const document = Document.create({
      id: this.idGenerator.next(),
      fileName: upload.file.fileName,
      metadata: upload.metadata,
      format: upload.format,
      sizeBytes: upload.file.sizeBytes,
    });

    await this.storage.save(document.storageKey, upload.file.buffer);
    await this.repository.save(document);

    try {
      await this.queue.enqueueIndexDocument(document.id);
    } catch (error) {
      // The row already exists; leave a visible trace instead of a document stuck in PROCESSING.
      document.markFailed(ENQUEUE_FAILURE_REASON);
      await this.repository.update(document);
      throw error;
    }

    return { id: document.id, status: document.status, fileName: document.fileName };
  }
}
