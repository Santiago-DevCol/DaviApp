import { JobQueue } from '../../domain/ports/job-queue';

export class RecordingJobQueue implements JobQueue {
  readonly enqueued: string[] = [];
  private failure: Error | null = null;

  failWith(error: Error): this {
    this.failure = error;
    return this;
  }

  async enqueueIndexDocument(documentId: string): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.enqueued.push(documentId);
  }
}
