import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpExceptionFilter } from '../../../shared/http/http-exception.filter';
import { InvalidSearchQueryError, SearchDomainError } from '../../domain/errors';

/**
 * Same approach as the documents capability: translate domain errors into
 * HTTP semantics and let the global filter render the `ApiError` body.
 * Unmapped search errors fall through to the generic 500 with logging.
 */
@Catch(SearchDomainError)
export class SearchErrorFilter implements ExceptionFilter<SearchDomainError> {
  private readonly delegate = new HttpExceptionFilter();

  catch(exception: SearchDomainError, host: ArgumentsHost): void {
    const mapped =
      exception instanceof InvalidSearchQueryError
        ? new BadRequestException(exception.message)
        : exception;
    this.delegate.catch(mapped, host);
  }
}
