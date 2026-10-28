import { useQueries } from '@tanstack/react-query';
import { DocumentStatus, type DocumentDetail, type UploadAcceptedItem } from '@techdocs/shared';
import { useCallback, useState } from 'react';
import { getDocument } from '@/api/documents.api';
import { queryKeys } from '@/lib/queryKeys';

export const TRACKED_UPLOADS_KEY = 'techdocs.trackedUploads';
const MAX_TRACKED = 50;

export interface TrackedUpload {
  id: string;
  fileName: string;
  title: string;
  acceptedAt: string;
}

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
 * through the SSE cache patches.
 */
export function useTrackedUploads() {
  const [entries, setEntries] = useState<TrackedUpload[]>(readStorage);

  const persist = useCallback((next: TrackedUpload[]) => {
    setEntries(next);
    writeStorage(next);
  }, []);

  const track = useCallback(
    (items: UploadAcceptedItem[], titles: string[]) => {
      const acceptedAt = new Date().toISOString();
      const added = items.map((item, index) => ({
        id: item.id,
        fileName: item.fileName,
        title: titles[index] ?? item.fileName,
        acceptedAt,
      }));
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
