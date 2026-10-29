import { DocumentRepository } from '../domain/ports/document.repository';
import { FileStorage } from '../domain/ports/file-storage';

export interface SweepOrphanFilesDependencies {
  repository: DocumentRepository;
  storage: FileStorage;
  /** A file older than this with no document row is an orphan. */
  orphanAfterMinutes: number;
}

/**
 * Removes stored files that no `documents` row references. They appear when
 * the process dies between writing the bytes and committing the row, or when
 * the best-effort delete after a failed transaction did not succeed. The age
 * threshold keeps in-flight uploads (file written, row not yet committed) out
 * of reach. Returns how many files were deleted.
 */
export class SweepOrphanFilesUseCase {
  private readonly repository: DocumentRepository;
  private readonly storage: FileStorage;
  private readonly orphanAfterMs: number;

  constructor(deps: SweepOrphanFilesDependencies) {
    this.repository = deps.repository;
    this.storage = deps.storage;
    this.orphanAfterMs = deps.orphanAfterMinutes * 60_000;
  }

  async execute(now: Date = new Date()): Promise<number> {
    const olderThan = new Date(now.getTime() - this.orphanAfterMs);
    const candidates = await this.storage.listKeysOlderThan(olderThan);
    if (candidates.length === 0) {
      return 0;
    }

    const referenced = await this.repository.existsByStorageKeys(candidates);
    let deleted = 0;
    for (const key of candidates) {
      if (!referenced.has(key)) {
        await this.storage.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }
}
