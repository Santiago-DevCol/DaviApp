import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { MockEventSource } from './mockEventSource';
import { resetFixtures } from './msw/handlers';
import { server } from './msw/server';

beforeAll(async () => {
  // jsdom replaces Blob/File/FormData with its own classes, which Node's
  // fetch (and so MSW's `request.formData()`) does not recognise: multipart
  // bodies would be sent as "[object FormData]" and never parsed. Use Node's
  // implementations for the whole suite so uploads round-trip through MSW.
  // Node does not export its FormData class, so it is taken from a parsed body.
  const emptyForm = await new Response('', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).formData();
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('FormData', Object.getPrototypeOf(emptyForm).constructor);

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
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetFixtures();
});

afterAll(() => server.close());
