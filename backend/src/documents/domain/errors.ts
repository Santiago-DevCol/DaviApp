/**
 * Base class for every error raised by the documents domain. Each subclass
 * carries a stable `code` so adapters (HTTP, workers) can map it without
 * matching on message text.
 */
export abstract class DocumentDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DocumentNotFoundError extends DocumentDomainError {
  readonly code = 'DOCUMENT_NOT_FOUND';

  constructor(readonly documentId: string) {
    super(`Document ${documentId} not found`);
  }
}

export class DocumentStateError extends DocumentDomainError {
  readonly code = 'INVALID_DOCUMENT_STATE';

  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Cannot transition document from ${from} to ${to}`);
  }
}

export class UnsupportedDocumentFormatError extends DocumentDomainError {
  readonly code = 'UNSUPPORTED_DOCUMENT_FORMAT';

  constructor(
    readonly fileName: string,
    readonly mimeType?: string,
  ) {
    super(
      `Unsupported document format for "${fileName}"` +
        (mimeType ? ` (${mimeType})` : '') +
        '. Allowed: .txt, .md, .pdf',
    );
  }
}

export class InvalidUploadBatchError extends DocumentDomainError {
  readonly code = 'INVALID_UPLOAD_BATCH';

  constructor(message: string) {
    super(message);
  }
}

export class FileTooLargeError extends DocumentDomainError {
  readonly code = 'FILE_TOO_LARGE';

  constructor(
    readonly fileName: string,
    readonly sizeBytes: number,
    readonly maxSizeBytes: number,
  ) {
    super(`File "${fileName}" is ${sizeBytes} bytes; the maximum allowed is ${maxSizeBytes} bytes`);
  }
}

export class TextExtractionError extends DocumentDomainError {
  readonly code = 'TEXT_EXTRACTION_FAILED';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
