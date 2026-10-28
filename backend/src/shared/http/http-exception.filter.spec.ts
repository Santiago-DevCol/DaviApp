import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost(path: string) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const request = { url: path };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('maps an HttpException with validation details to a structured body', () => {
    const { host, response } = createHost('/documents');
    const exception = new BadRequestException(['title must be a string', 'tags must be an array']);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = response.json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: ['title must be a string', 'tags must be an array'],
      path: '/documents',
    });
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('maps an unknown error to a generic 500, logging the real error', () => {
    const { host, response } = createHost('/search');
    const exception = new Error('connection refused to 10.0.0.1');
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(exception, host);

    expect(logSpy).toHaveBeenCalledWith('connection refused to 10.0.0.1', exception.stack);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = response.json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: '/search',
    });
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('10.0.0.1');
  });
});
