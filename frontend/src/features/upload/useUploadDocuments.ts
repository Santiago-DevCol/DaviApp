import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentStatus, type DocumentDetail, type UploadAcceptedResponse } from '@techdocs/shared';
import { uploadDocuments, type UploadDocumentsInput } from '@/api/documents.api';
import { queryKeys } from '@/lib/queryKeys';

export interface UseUploadDocumentsOptions {
  onAccepted?: (response: UploadAcceptedResponse, input: UploadDocumentsInput) => void;
}

export function useUploadDocuments(options: UseUploadDocumentsOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadDocuments,
    onSuccess: (response, input) => {
      // Seed the cache so the tracked list (and any later SSE patch) has a
      // document to work with before the first GET completes. The seed is
      // then invalidated: the worker may have published the status event
      // before the 202 arrived (it is skipped when nothing is cached), so the
      // real status must be fetched regardless of the seeded PROCESSING.
      response.items.forEach((item, index) => {
        const metadata = input.metadata[index];
        const file = input.files[index];
        if (!metadata || !file) return;
        const now = new Date().toISOString();
        const seed: DocumentDetail = {
          id: item.id,
          ...metadata,
          format: fileFormat(item.fileName),
          fileName: item.fileName,
          sizeBytes: file.size,
          status: item.status ?? DocumentStatus.PROCESSING,
          createdAt: now,
          updatedAt: now,
          content: null,
          errorMessage: null,
        };
        const key = queryKeys.document(item.id);
        queryClient.setQueryData<DocumentDetail>(key, (existing) => existing ?? seed);
        // Marks the seed stale; the tracked list refetches it as soon as it
        // observes the key (or right away if a screen already does).
        void queryClient.invalidateQueries({ queryKey: key });
      });
      options.onAccepted?.(response, input);
    },
  });
}

function fileFormat(fileName: string): DocumentDetail['format'] {
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return extension === 'md' || extension === 'pdf' ? extension : 'txt';
}
