import type { PgBoss, QueueOptions } from 'pg-boss';

export const INDEX_DOCUMENT_QUEUE = 'index-document';

export interface IndexDocumentJobData {
  documentId: string;
}

/**
 * Retry policy for indexing jobs: three retries with exponential backoff
 * starting at 5s (5s, ~10s, ~20s); a job stuck in `active` for 5 minutes is
 * treated as failed and retried. Applied to the queue defaults and repeated on
 * every `send()` so the job rows and the queue row agree.
 */
export const INDEX_DOCUMENT_JOB_OPTIONS: QueueOptions = {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 5,
  expireInSeconds: 300,
};

/**
 * pg-boss >= 10 requires queues to exist before jobs are sent to them. The
 * underlying SQL is `INSERT ... ON CONFLICT DO NOTHING`, so calling this from
 * both the producer and the worker is safe (an existing queue keeps its row).
 */
export async function ensureIndexDocumentQueue(boss: PgBoss): Promise<void> {
  await boss.createQueue(INDEX_DOCUMENT_QUEUE, INDEX_DOCUMENT_JOB_OPTIONS);
}
