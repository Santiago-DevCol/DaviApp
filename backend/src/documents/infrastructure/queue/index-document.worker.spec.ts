import { Logger } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { FailDocumentUseCase } from '../../application/fail-document.use-case';
import { IndexDocumentUseCase } from '../../application/index-document.use-case';
import { DocumentNotFoundError } from '../../domain/errors';
import { INDEX_DOCUMENT_JOB_OPTIONS } from './index-document.job';
import { IndexDocumentJob, IndexDocumentWorker } from './index-document.worker';

const DOCUMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONFIGURED_RETRY_LIMIT = INDEX_DOCUMENT_JOB_OPTIONS.retryLimit as number;
const UNAVAILABLE_REASON =
  'No se pudo indexar después de 4 intentos. No se pudo indexar por un problema temporal del servicio. Vuelve a intentarlo en unos minutos.';

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as { cause?: unknown }).cause = cause;
  return error;
}

function jobAt(retryCount: number, retryLimit?: number): IndexDocumentJob {
  const job: IndexDocumentJob = {
    id: 'job-1',
    name: 'index-document',
    data: { documentId: DOCUMENT_ID },
    expireInSeconds: 300,
    heartbeatSeconds: null,
    retryCount,
    signal: new AbortController().signal,
  };
  if (retryLimit !== undefined) {
    job.retryLimit = retryLimit;
  }
  return job;
}

describe('IndexDocumentWorker.handle', () => {
  let indexDocument: { execute: jest.Mock };
  let failDocument: { execute: jest.Mock };
  let worker: IndexDocumentWorker;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    indexDocument = { execute: jest.fn() };
    failDocument = { execute: jest.fn().mockResolvedValue(undefined) };
    worker = new IndexDocumentWorker(
      {} as PgBoss,
      indexDocument as unknown as IndexDocumentUseCase,
      failDocument as unknown as FailDocumentUseCase,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the indexing use case for the job document', async () => {
    indexDocument.execute.mockResolvedValue(undefined);

    await worker.handle(jobAt(0, 3));

    expect(indexDocument.execute).toHaveBeenCalledWith(DOCUMENT_ID);
    expect(failDocument.execute).not.toHaveBeenCalled();
  });

  it('rethrows on a non-final attempt without settling the document', async () => {
    const outage = new Error('connection terminated unexpectedly');
    indexDocument.execute.mockRejectedValue(outage);

    await expect(worker.handle(jobAt(1, 3))).rejects.toBe(outage);

    expect(failDocument.execute).not.toHaveBeenCalled();
  });

  it('settles the document as ERROR on the final attempt and still rethrows', async () => {
    const outage = new Error('connection terminated unexpectedly');
    indexDocument.execute.mockRejectedValue(outage);

    await expect(worker.handle(jobAt(3, 3))).rejects.toBe(outage);

    expect(failDocument.execute).toHaveBeenCalledTimes(1);
    expect(failDocument.execute).toHaveBeenCalledWith(DOCUMENT_ID, UNAVAILABLE_REASON);
  });

  it('logs the internal cause with query parameters redacted', async () => {
    const error = withCause(
      'Failed query: update "documents" set status = $1\nparams: INDEXED,,term0 term1',
      new Error('string is too long for tsvector (2779804 bytes, max 1048575 bytes)'),
    );
    indexDocument.execute.mockRejectedValue(error);

    await expect(worker.handle(jobAt(0, 3))).rejects.toBe(error);

    const logged = errorLog.mock.calls[0][0] as string;
    expect(logged).toContain('tsvector');
    expect(logged).toContain('params: [redacted]');
    expect(logged).not.toContain('term0');
  });

  it('falls back to the configured retry limit when the job carries none', async () => {
    const outage = new Error('boom');
    indexDocument.execute.mockRejectedValue(outage);

    await expect(worker.handle(jobAt(CONFIGURED_RETRY_LIMIT - 1))).rejects.toBe(outage);
    expect(failDocument.execute).not.toHaveBeenCalled();

    await expect(worker.handle(jobAt(CONFIGURED_RETRY_LIMIT))).rejects.toBe(outage);
    expect(failDocument.execute).toHaveBeenCalledTimes(1);
  });

  it('never copies the raw error into the failure reason', async () => {
    indexDocument.execute.mockRejectedValue(new Error('x'.repeat(1000)));

    await expect(worker.handle(jobAt(3, 3))).rejects.toThrow();

    const [, reason] = failDocument.execute.mock.calls[0] as [string, string];
    expect(reason).toContain('No se pudo indexar después de 4 intentos.');
    expect(reason).not.toContain('x'.repeat(10));
    expect(reason.length).toBeLessThanOrEqual(300);
  });

  it('drops the job when the document no longer exists', async () => {
    indexDocument.execute.mockRejectedValue(new DocumentNotFoundError(DOCUMENT_ID));

    await expect(worker.handle(jobAt(3, 3))).resolves.toBeUndefined();

    expect(failDocument.execute).not.toHaveBeenCalled();
  });

  it('rethrows the original error and logs when the fallback itself fails', async () => {
    const original = new Error('original failure');
    indexDocument.execute.mockRejectedValue(original);
    failDocument.execute.mockRejectedValue(new Error('database still down'));

    await expect(worker.handle(jobAt(3, 3))).rejects.toBe(original);

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('database still down'),
      expect.anything(),
    );
  });
});
