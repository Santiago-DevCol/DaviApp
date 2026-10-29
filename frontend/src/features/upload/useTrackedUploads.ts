import { useQueries } from '@tanstack/react-query';
import {
  DocumentStatus,
  type DocumentDetail,
  type DocumentMetadataInput,
  type UploadAcceptedItem,
} from '@techdocs/shared';
import { useCallback, useState } from 'react';
import { getDocument } from '@/api/documents.api';
import { processingPollInterval } from '@/lib/polling';
import { queryKeys } from '@/lib/queryKeys';

export const TRACKED_UPLOADS_KEY = 'techdocs.trackedUploads';
const MAX_TRACKED = 50;

export interface TrackedUpload {
  id: string;
  fileName: string;
  title: string;
  acceptedAt: string;
  /** Version the user typed in the form (absent in entries stored before versioning). */
  sentVersion?: string;
  /** Version the backend assigned; may differ from `sentVersion` when it was auto-bumped. */
  version?: string;
  /** Set when the upload matched an existing document byte for byte; `id` is that document's. */
  duplicateOf?: { id: string; version: string };
}

/** Fields the user sent for each accepted file, in the same order as the 202 items. */
export type SentMetadata = Pick<DocumentMetadataInput, 'title' | 'version'>;

export interface TrackedUploadView extends TrackedUpload {
  status: DocumentStatus | null;
  errorMessage: string | null;
  loadError: string | null;
}

function readStorage(): TrackedUpload[] {
  try {
    const raw = window.sessionStorage.getItem(TRACKED_UPLOADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TrackedUpload =>
        typeof entry === 'object' && entry !== null && typeof (entry as TrackedUpload).id === 'string',
    );
  } catch {
    return [];
  }
}

function writeStorage(entries: TrackedUpload[]): void {
  try {
    window.sessionStorage.setItem(TRACKED_UPLOADS_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be unavailable (private mode, quota); tracking is best effort.
  }
}

/**
 * Uploads accepted in this browser tab, persisted in `sessionStorage` so a
 * reload keeps the list. Each tracked document is fetched once on mount,
 * covering status events missed while the tab was closed; later changes come
 * through the SSE cache patches. Documents still PROCESSING are also polled,
 * so a status event lost or delivered before the upload was tracked can never
 * leave a row stuck.
 */
export function useTrackedUploads() {
  const [entries, setEntries] = useState<TrackedUpload[]>(readStorage);

  const persist = useCallback((next: TrackedUpload[]) => {
    setEntries(next);
    writeStorage(next);
  }, []);

  const track = useCallback(
    (items: UploadAcceptedItem[], sent: SentMetadata[]) => {
      const acceptedAt = new Date().toISOString();
      const added = items.map((item, index): TrackedUpload => {
        const entry: TrackedUpload = {
          id: item.id,
          fileName: item.fileName,
          title: sent[index]?.title ?? item.fileName,
          acceptedAt,
        };
        const sentVersion = sent[index]?.version;
        if (sentVersion) entry.sentVersion = sentVersion;
        if (item.version) entry.version = item.version;
        if (item.duplicateOf) entry.duplicateOf = item.duplicateOf;
        return entry;
      });
      const known = new Set(added.map((entry) => entry.id));
      persist([...added, ...entries.filter((entry) => !known.has(entry.id))].slice(0, MAX_TRACKED));
    },
    [entries, persist],
  );

  const untrack = useCallback(
    (id: string) => persist(entries.filter((entry) => entry.id !== id)),
    [entries, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const queries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: queryKeys.document(entry.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getDocument(entry.id, signal),
      staleTime: Infinity,
      refetchOnMount: true,
      // A duplicate row points at a document that already existed; its status
      // is informational, so it is never polled.
      refetchInterval: entry.duplicateOf ? false : processingPollInterval,
    })),
  });

  const views: TrackedUploadView[] = entries.map((entry, index) => {
    const query = queries[index];
    const data = query?.data as DocumentDetail | undefined;
    return {
      ...entry,
      title: data?.title ?? entry.title,
      status: data?.status ?? null,
      errorMessage: data?.errorMessage ?? null,
      loadError: query?.error ? (query.error as Error).message : null,
    };
  });

  return { entries: views, track, untrack, clear };
}
