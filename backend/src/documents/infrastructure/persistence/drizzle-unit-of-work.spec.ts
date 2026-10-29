import { Logger } from '@nestjs/common';
import type { Database } from '../../../shared/database/database.provider';
import { JobQueue } from '../../domain/ports/job-queue';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';

interface FakeClient {
  query: jest.Mock;
  release: jest.Mock;
}

const statementsOf = (client: FakeClient): string[] => client.query.mock.calls.map(([text]) => text as string);

function buildUnitOfWork(client: FakeClient): DrizzleUnitOfWork {
  const pool = { connect: jest.fn().mockResolvedValue(client) };
  // Only `$client.connect()` is touched by the unit of work; the Drizzle half of
  // `Database` is never called here, so a minimal pool stand-in is enough.
  const db = { $client: pool } as unknown as Database;
  const queue: JobQueue = { enqueueIndexDocument: jest.fn() };
  return new DrizzleUnitOfWork(db, () => queue);
}

describe('DrizzleUnitOfWork', () => {
  let client: FakeClient;

  beforeEach(() => {
    client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wraps the callback in BEGIN/COMMIT and returns the client to the pool', async () => {
    const result = await buildUnitOfWork(client).run(async () => 'ok');

    expect(result).toBe('ok');
    expect(statementsOf(client)).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith();
  });

  it('rolls back, rethrows the original error and returns the client when the callback fails', async () => {
    const failure = new Error('callback failed');

    await expect(buildUnitOfWork(client).run(async () => Promise.reject(failure))).rejects.toBe(failure);

    expect(statementsOf(client)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith();
  });

  it('keeps the original error and destroys the client when ROLLBACK itself fails', async () => {
    const failure = new Error('callback failed');
    client.query.mockImplementation(async (text: string) => {
      if (text === 'ROLLBACK') {
        throw new Error('connection terminated');
      }
      return { rows: [] };
    });

    await expect(buildUnitOfWork(client).run(async () => Promise.reject(failure))).rejects.toBe(failure);

    expect(statementsOf(client)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('propagates a COMMIT failure and destroys the client', async () => {
    const commitFailure = new Error('could not serialize access');
    client.query.mockImplementation(async (text: string) => {
      if (text === 'COMMIT') {
        throw commitFailure;
      }
      return { rows: [] };
    });

    await expect(buildUnitOfWork(client).run(async () => 'ok')).rejects.toBe(commitFailure);

    expect(statementsOf(client)).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
