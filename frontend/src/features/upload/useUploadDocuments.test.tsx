import { QueryClientProvider } from '@tanstack/react-query';
import { DocumentStatus, type DocumentDetail, type DocumentMetadataInput } from '@techdocs/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PROCESSING_POLL_MS } from '@/lib/polling';
import { queryKeys } from '@/lib/queryKeys';
import { PROCESSING_DOC, setDocument } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { TRACKED_UPLOADS_KEY, useTrackedUploads } from './useTrackedUploads';
import { useUploadDocuments } from './useUploadDocuments';

/** Id the MSW `POST /documents` handler assigns to the first accepted file. */
const FIRST_ACCEPTED_ID = '33333333-3333-4333-8333-000000000000';

const METADATA: DocumentMetadataInput = {
  title: 'Notas de prueba',
  author: 'Ana Ruiz',
  category: 'Pruebas',
  tags: ['qa'],
  version: '1.0.0',
};

function textFile(name: string, content = 'hola'): File {
  return new File([content], name, { type: 'text/plain' });
}

/** Mirrors how `UploadPage` wires both hooks together. */
function useUploadHarness() {
  const tracked = useTrackedUploads();
  const upload = useUploadDocuments({
    onAccepted: (response, input) => tracked.track(response.items, input.metadata),
  });
  return { tracked, upload };
}

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useUploadHarness(), { wrapper }) };
}

/**
 * Waits for the 202 to be processed by both hooks. `track` runs inside the
 * mutation's `onSuccess`, but its `setEntries` is committed by a later render
 * than the one that flips `isSuccess` (the mutation store notifies React
 * synchronously, the state update waits for the scheduler), so reading the
 * tracked list right after `isSuccess` can observe an empty intermediate commit.
 */
async function waitForAccepted(result: { current: ReturnType<typeof useUploadHarness> }, count: number) {
  await waitFor(() => {
    expect(result.current.upload.isSuccess).toBe(true);
    expect(result.current.tracked.entries).toHaveLength(count);
  });
}

describe('useUploadDocuments + useTrackedUploads', () => {
  it('converges to INDEXED when the status event lands before the 202 (no SSE event at all)', async () => {
    // The worker already finished file 1 before the batch answered 202: the
    // backend's GET reports INDEXED while the 202 body still says PROCESSING.
    setDocument({ ...PROCESSING_DOC, id: FIRST_ACCEPTED_ID, title: METADATA.title, status: DocumentStatus.INDEXED });
    const { client, result } = setup();

    act(() => result.current.upload.mutate({ files: [textFile('notas.txt')], metadata: [METADATA] }));

    await waitForAccepted(result, 1);
    // The optimistic row is tracked with the seeded document before any GET answers.
    expect(result.current.tracked.entries[0]?.id).toBe(FIRST_ACCEPTED_ID);
    expect(client.getQueryData<DocumentDetail>(queryKeys.document(FIRST_ACCEPTED_ID))).toBeDefined();

    await waitFor(() => expect(result.current.tracked.entries[0]?.status).toBe(DocumentStatus.INDEXED));
  });

  it('polls a tracked document while it is still processing and stops once indexed', async () => {
    window.sessionStorage.setItem(
      TRACKED_UPLOADS_KEY,
      JSON.stringify([
        { id: PROCESSING_DOC.id, fileName: PROCESSING_DOC.fileName, title: PROCESSING_DOC.title, acceptedAt: 'x' },
      ]),
    );
    const { client, result } = setup();
    await waitFor(() => expect(result.current.tracked.entries[0]?.status).toBe(DocumentStatus.PROCESSING));

    const query = client.getQueryCache().find({ queryKey: queryKeys.document(PROCESSING_DOC.id) });
    const observer = query?.observers[0];
    const interval = observer?.options.refetchInterval;
    expect(typeof interval).toBe('function');
    if (typeof interval !== 'function' || !query) throw new Error('refetchInterval should be a function');

    expect(interval(query)).toBe(PROCESSING_POLL_MS);

    setDocument({ ...PROCESSING_DOC, status: DocumentStatus.INDEXED });
    await act(() => client.invalidateQueries({ queryKey: queryKeys.document(PROCESSING_DOC.id) }));
    await waitFor(() => expect(result.current.tracked.entries[0]?.status).toBe(DocumentStatus.INDEXED));
    expect(interval(query)).toBe(false);
  });

  it('sends `files` parts aligned with the `metadata` JSON array', async () => {
    let received: FormData | null = null;
    server.use(
      http.post('*/api/documents', async ({ request }) => {
        received = await request.formData();
        return HttpResponse.json(
          {
            items: [
              { id: 'a', status: DocumentStatus.PROCESSING, fileName: 'uno.txt' },
              { id: 'b', status: DocumentStatus.PROCESSING, fileName: 'dos.md' },
            ],
          },
          { status: 202 },
        );
      }),
    );
    const { result } = setup();
    const second: DocumentMetadataInput = { ...METADATA, title: 'Segundo' };

    act(() =>
      result.current.upload.mutate({
        files: [textFile('uno.txt'), textFile('dos.md', '# dos')],
        metadata: [METADATA, second],
      }),
    );
    await waitForAccepted(result, 2);

    const form = received as FormData | null;
    expect(form).not.toBeNull();
    const files = form!.getAll('files').filter((entry): entry is File => entry instanceof File);
    expect(files.map((file) => file.name)).toEqual(['uno.txt', 'dos.md']);
    expect(JSON.parse(String(form!.get('metadata')))).toEqual([METADATA, second]);
    expect(result.current.tracked.entries.map((entry) => entry.title)).toEqual(['Notas de prueba', 'Segundo']);
  });

  it('keeps the sent and assigned versions and does not seed or poll duplicates', async () => {
    server.use(
      http.post('*/api/documents', () =>
        HttpResponse.json(
          {
            items: [
              { id: 'bumped', status: DocumentStatus.PROCESSING, fileName: 'uno.txt', version: '1.0.1' },
              {
                id: PROCESSING_DOC.id,
                status: DocumentStatus.PROCESSING,
                fileName: 'dos.txt',
                version: '1.0.0',
                duplicateOf: { id: PROCESSING_DOC.id, version: '1.0.0' },
              },
            ],
          },
          { status: 202 },
        ),
      ),
    );
    const { client, result } = setup();

    act(() =>
      result.current.upload.mutate({
        files: [textFile('uno.txt'), textFile('dos.txt')],
        metadata: [METADATA, { ...METADATA, title: 'Segundo' }],
      }),
    );
    await waitForAccepted(result, 2);

    const [bumped, duplicate] = result.current.tracked.entries;
    expect(bumped).toMatchObject({ id: 'bumped', sentVersion: '1.0.0', version: '1.0.1' });
    expect(duplicate).toMatchObject({ id: PROCESSING_DOC.id, duplicateOf: { id: PROCESSING_DOC.id, version: '1.0.0' } });
    expect(JSON.parse(window.sessionStorage.getItem(TRACKED_UPLOADS_KEY) ?? '[]')[1]).toMatchObject({
      duplicateOf: { id: PROCESSING_DOC.id, version: '1.0.0' },
    });

    // The duplicate is the existing document: nothing is seeded for it and it is not polled.
    expect(client.getQueryData<DocumentDetail>(queryKeys.document('bumped'))?.status).toBe(DocumentStatus.PROCESSING);
    const query = client.getQueryCache().find({ queryKey: queryKeys.document(PROCESSING_DOC.id) });
    const interval = query?.observers[0]?.options.refetchInterval;
    expect(interval).toBe(false);
  });
});
