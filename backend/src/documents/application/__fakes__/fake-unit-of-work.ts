import { TransactionContext, UnitOfWork } from '../../domain/ports/unit-of-work';
import { InMemoryDocumentRepository } from './in-memory-document.repository';
import { RecordingJobQueue } from './recording-job.queue';

/**
 * Rollback semantics over the in-memory fakes: the repository rows and the
 * queue are snapshotted before the callback and restored when it throws, or
 * when a commit failure is simulated with `failCommitWith`.
 */
export class FakeUnitOfWork implements UnitOfWork {
  readonly lockedKeys: string[] = [];
  private commitFailure: Error | null = null;

  constructor(
    readonly repository: InMemoryDocumentRepository,
    readonly queue: RecordingJobQueue,
  ) {}

  failCommitWith(error: Error): this {
    this.commitFailure = error;
    return this;
  }

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    const rows = this.repository.snapshotRows();
    const jobs = this.queue.snapshot();
    const ctx: TransactionContext = {
      repository: this.repository,
      queue: this.queue,
      lockDocumentKey: async (documentKey) => {
        this.lockedKeys.push(documentKey);
      },
    };
    try {
      const result = await fn(ctx);
      if (this.commitFailure) {
        const failure = this.commitFailure;
        this.commitFailure = null;
        throw failure;
      }
      return result;
    } catch (error) {
      this.repository.restoreRows(rows);
      this.queue.restore(jobs);
      throw error;
    }
  }
}
