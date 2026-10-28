import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@techdocs/shared';
import type { Request, Response } from 'express';

type ErrorDescription = Omit<ApiError, 'timestamp' | 'path'>;

/**
 * Normalizes every error into the `ApiError` contract shared with the frontend.
 * Validation errors keep their per-constraint messages under `details`;
 * unexpected errors are logged with their stack and answered with a generic 500.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body: ApiError = {
      ...this.describe(exception),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(body.statusCode).json(body);
  }

  private describe(exception: unknown): ErrorDescription {
    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private describeHttpException(exception: HttpException): ErrorDescription {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, error: exception.name, message: payload };
    }

    const { error, message } = payload as { error?: string; message?: string | string[] };
    const errorName = error ?? exception.name;

    if (Array.isArray(message)) {
      // ValidationPipe reports one entry per failed constraint.
      return { statusCode, error: errorName, message: 'Validation failed', details: message };
    }

    return { statusCode, error: errorName, message: message ?? exception.message };
  }
}
