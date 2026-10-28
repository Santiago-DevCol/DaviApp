import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { MockEventSource } from './mockEventSource';
import { resetFixtures } from './msw/handlers';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // jsdom installs its own AbortSignal, which Node's fetch/Request (and thus
  // MSW) reject. Strip the signal before it reaches them; cancellation is not
  // exercised by these tests.
  const interceptedFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    interceptedFetch(input, init ? { ...init, signal: undefined } : init);
});

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource);
  MockEventSource.reset();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetFixtures();
});

afterAll(() => server.close());
