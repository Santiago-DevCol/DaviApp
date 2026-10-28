import { useQueryClient } from '@tanstack/react-query';
import { DocumentStatus, type DocumentDetail, type DocumentStatusEvent } from '@techdocs/shared';
import { useEffect, useRef, useState } from 'react';
import { createDocumentEventSource, DOCUMENT_STATUS_EVENT, parseDocumentStatusEvent } from '@/api/events';
import { queryKeys } from '@/lib/queryKeys';
import type { ToastInput } from './ToastContext';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface UseDocumentEventsOptions {
  /** Receives a toast for every status transition; wired to the toast store by the provider. */
  notify?: (toast: ToastInput) => void;
  /** Observer hook for tests and future consumers. */
  onEvent?: (event: DocumentStatusEvent) => void;
  /** Delay before re-creating a stream the browser gave up on (readyState CLOSED). */
  reopenDelayMs?: number;
}

const DEFAULT_REOPEN_DELAY_MS = 5000;

/**
 * Keeps a single SSE connection to `/events` and projects `document.status`
 * events into the TanStack Query cache: the cached `DocumentDetail` (if any)
 * is patched immediately so every screen flips its badge, then invalidated so
 * the final content/metadata is fetched; search results are invalidated too.
 *
 * Reconnection and `Last-Event-ID` replay are native to `EventSource`; the
 * hook only re-creates the stream when the browser marks it CLOSED (e.g. the
 * server answered with a non-retryable status).
 */
export function useDocumentEvents(options: UseDocumentEventsOptions = {}): ConnectionState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionState>('connecting');
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let source: EventSource | null = null;
    let reopenTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const applyEvent = (event: DocumentStatusEvent) => {
      const key = queryKeys.document(event.id);
      const previous = queryClient.getQueryData<DocumentDetail>(key);
      if (previous) {
        queryClient.setQueryData<DocumentDetail>(key, {
          ...previous,
          status: event.status,
          errorMessage: event.errorMessage ?? null,
          updatedAt: event.occurredAt,
        });
      }
      // Fetch the full detail (content, final metadata) for anyone observing it.
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: queryKeys.searches });

      latest.current.notify?.(toastFor(event, previous));
      latest.current.onEvent?.(event);
    };

    const onStatus = (raw: Event) => {
      const data = (raw as MessageEvent<string>).data;
      const event = parseDocumentStatusEvent(typeof data === 'string' ? data : '');
      if (event) applyEvent(event);
    };

    let streams = 0;

    const connect = () => {
      if (disposed) return;
      setState('connecting');
      // `Last-Event-ID` replay only covers the browser's own reconnects of a
      // stream; anything published while no stream existed is lost, so a
      // re-created stream refreshes what the app may be showing once it opens.
      const resync = streams > 0;
      streams += 1;
      source = createDocumentEventSource();
      source.addEventListener('open', () => {
        setState('open');
        if (resync) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
          void queryClient.invalidateQueries({ queryKey: queryKeys.searches });
        }
      });
      source.addEventListener('error', () => {
        if (!source) return;
        if (source.readyState === EventSource.CLOSED) {
          setState('closed');
          source.close();
          source = null;
          reopenTimer = setTimeout(connect, latest.current.reopenDelayMs ?? DEFAULT_REOPEN_DELAY_MS);
        } else {
          setState('reconnecting');
        }
      });
      source.addEventListener(DOCUMENT_STATUS_EVENT, onStatus);
    };

    connect();

    return () => {
      disposed = true;
      if (reopenTimer) clearTimeout(reopenTimer);
      source?.close();
      source = null;
    };
  }, [queryClient]);

  return state;
}

function toastFor(event: DocumentStatusEvent, previous: DocumentDetail | undefined): ToastInput {
  const name = previous?.title ?? 'Documento';
  switch (event.status) {
    case DocumentStatus.INDEXED:
      return {
        tone: 'success',
        title: 'Documento indexado',
        description: name,
        href: `/documents/${event.id}`,
      };
    case DocumentStatus.ERROR:
      return {
        tone: 'danger',
        title: 'Error al procesar el documento',
        description: event.errorMessage ? `${name}: ${event.errorMessage}` : name,
        href: `/documents/${event.id}`,
        durationMs: 0,
      };
    default:
      return { tone: 'info', title: 'Documento en proceso', description: name };
  }
}
