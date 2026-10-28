import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Database } from '../shared/database/database.provider';
import { HealthController } from './health.controller';

function fakeDatabase(execute: () => Promise<unknown>): Database {
  return { execute } as unknown as Database;
}

function fakeResponse() {
  return { status: jest.fn().mockReturnThis() } as unknown as Response & { status: jest.Mock };
}

describe('HealthController', () => {
  it('answers 200 ok when the database responds', async () => {
    const controller = new HealthController(fakeDatabase(() => Promise.resolve([{ '?column?': 1 }])));
    const response = fakeResponse();

    const body = await controller.check(response);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('answers 503 degraded when the database check fails', async () => {
    const controller = new HealthController(
      fakeDatabase(() => Promise.reject(new Error('connection refused'))),
    );
    const response = fakeResponse();

    const body = await controller.check(response);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body).toMatchObject({ status: 'degraded', database: 'down' });
  });
});
