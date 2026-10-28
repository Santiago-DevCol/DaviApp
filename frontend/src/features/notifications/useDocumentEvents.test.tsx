import { QueryClientProvider } from '@tanstack/react-query';
import { DocumentStatus, type DocumentDetail } from '@techdocs/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { MockEventSource } from '@/test/mockEventSource';
import { PROCESSING_DOC } from '@/test/msw/handlers';
import { createTestQueryClient } from '@/test/render';
import { useDocumentEvents } from './useDocumentEvents';

function setup() {
  const client = createTestQueryClient();
  const notify = vi.fn();
  const onEvent = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDocumentEvents({ notify, onEvent, reopenDelayMs: 10 }), { wrapper });
  return { client, notify, onEvent, ...hook };
}

describe('useDocumentEvents', () => {
  it('opens one stream against /events and reports its connection state', () => {
    const { result } = setup();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.latest().url).toMatch(/\/api\/events$/);
    expect(result.current).toBe('connecting');

    act(() => MockEventSource.latest().emitOpen());
    expect(result.current).toBe('open');

    act(() => MockEventSource.latest().emitError());
    expect(result.current).toBe('reconnecting');
  });

  it('patches the cached document and notifies on document.status', async () => {
    const { client, notify, onEvent } = setup();
    client.setQueryData<DocumentDetail>(queryKeys.document(PROCESSING_DOC.id), PROCESSING_DOC);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    act(() =>
      MockEventSource.latest().emit('document.status', {
        id: PROCESSING_DOC.id,
        status: DocumentStatus.INDEXED,
        occurredAt: '2026-10-02T10:00:09.000Z',
      }),
    );

    const cached = client.getQueryData<DocumentDetail>(queryKeys.document(PROCESSING_DOC.id));
    expect(cached?.status).toBe(DocumentStatus.INDEXED);
    expect(cached?.updatedAt).toBe('2026-10-02T10:00:09.000Z');
    expect(cached?.title).toBe(PROCESSING_DOC.title);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.document(PROCESSING_DOC.id) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.searches });
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: PROCESSING_DOC.id, status: 'INDEXED' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'success', title: 'Documento indexado', description: PROCESSING_DOC.title }),
      ),
    );
  });

  it('surfaces the error message for ERROR events', () => {
    const { client, notify } = setup();
    client.setQueryData<DocumentDetail>(queryKeys.document(PROCESSING_DOC.id), PROCESSING_DOC);

    act(() =>
      MockEventSource.latest().emit('document.status', {
        id: PROCESSING_DOC.id,
        status: DocumentStatus.ERROR,
        errorMessage: 'PDF corrupto',
        occurredAt: '2026-10-02T10:00:09.000Z',
      }),
    );

    expect(client.getQueryData<DocumentDetail>(queryKeys.document(PROCESSING_DOC.id))?.errorMessage).toBe(
      'PDF corrupto',
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger', description: expect.stringContaining('PDF corrupto') }));
  });

  it('ignores malformed payloads', () => {
    const { notify, onEvent } = setup();
    act(() => MockEventSource.latest().emit('document.status', 'not json'));
    act(() => MockEventSource.latest().emit('document.status', { id: 'x', status: 'DONE' }));
    expect(notify).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('re-creates the stream when the browser gives up on it', async () => {
    const { result } = setup();
    act(() => MockEventSource.latest().emitError(true));
    expect(result.current).toBe('closed');
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(result.current).toBe('connecting');
  });

  it('resyncs document and search queries when a re-created stream opens', async () => {
    const { client } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    // The very first connection has nothing to catch up on.
    act(() => MockEventSource.latest().emitOpen());
    expect(invalidate).not.toHaveBeenCalled();

    // Events published during the outage are lost: the new stream resyncs.
    act(() => MockEventSource.latest().emitError(true));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    act(() => MockEventSource.latest().emitOpen());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.documents });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.searches });
  });

  it('closes the stream on unmount', () => {
    const { unmount } = setup();
    const source = MockEventSource.latest();
    unmount();
    expect(source.readyState).toBe(MockEventSource.CLOSED);
  });
});
