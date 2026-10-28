export interface JobQueue {
  enqueueIndexDocument(documentId: string): Promise<void>;
}

export const JOB_QUEUE = Symbol('JobQueue');
