import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../../shared/http/http-exception.filter';
import {
  DocumentDomainError,
  DocumentNotFoundError,
  DocumentStateError,
  FileTooLargeError,
  InvalidUploadBatchError,
  UnsupportedDocumentFormatError,
} from '../../domain/errors';

/**
 * Translates documents domain errors into HTTP semantics and delegates the
 * rendering to the global filter, so every error body keeps the `ApiError`
 * contract. Scoped to the documents controller; anything unmapped (an
 * unexpected domain error) falls through to the generic 500 with logging.
 */
@Catch(DocumentDomainError)
export class DomainErrorFilter implements ExceptionFilter<DocumentDomainError> {
  private readonly delegate = new HttpExceptionFilter();

  catch(exception: DocumentDomainError, host: ArgumentsHost): void {
    this.delegate.catch(toHttpException(exception) ?? exception, host);
  }
}

function toHttpException(error: DocumentDomainError): HttpException | null {
  if (error instanceof DocumentNotFoundError) {
    return new NotFoundException(error.message);
  }
  if (error instanceof UnsupportedDocumentFormatError || error instanceof InvalidUploadBatchError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof FileTooLargeError) {
    return new PayloadTooLargeException(error.message);
  }
  if (error instanceof DocumentStateError) {
    return new ConflictException(error.message);
  }
  return null;
}
