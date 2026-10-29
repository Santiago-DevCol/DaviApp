import { describeError } from '../../shared/errors/error-details';
import { DocumentRepository } from '../domain/ports/document.repository';
import { FileStorage } from '../domain/ports/file-storage';

export interface OrphanSweepLogger {
  warn(message: string): void;
}

export interface SweepOrphanFilesDependencies {
  repository: DocumentRepository;
  storage: FileStorage;
  /** A file older than this with no document row is an orphan. */
  orphanAfterMinutes: number;
  logger?: OrphanSweepLogger;
}

export interface SweepOrphanFilesResult {
  /** Orphan files removed in this run. */
  deleted: number;
  /** Orphan files whose delete failed; they stay for the next run. */
  failed: number;
}

/**
 * Removes stored files that no `documents` row references. They appear when
 * the process dies between writing the bytes and committing the row, or when
 * the best-effort delete after a failed transaction did not succeed. The age
 * threshold keeps in-flight uploads (file written, row not yet committed) out
 * of reach. Each file is handled independently: a delete that fails (locked
 * file, permissions, transient I/O) is logged and counted as failed, and the
 * remaining orphans are still removed. Returns both counts.
 */
export class SweepOrphanFilesUseCase {
  private readonly repository: DocumentRepository;
  private readonly storage: FileStorage;
  private readonly orphanAfterMs: number;
  private readonly logger: OrphanSweepLogger;

  constructor(deps: SweepOrphanFilesDependencies) {
    this.repository = deps.repository;
    this.storage = deps.storage;
    this.orphanAfterMs = deps.orphanAfterMinutes * 60_000;
    this.logger = deps.logger ?? { warn: () => undefined };
  }

  async execute(now: Date = new Date()): Promise<SweepOrphanFilesResult> {
    const olderThan = new Date(now.getTime() - this.orphanAfterMs);
    const candidates = await this.storage.listKeysOlderThan(olderThan);
    if (candidates.length === 0) {
      return { deleted: 0, failed: 0 };
    }

    const referenced = await this.repository.existsByStorageKeys(candidates);
    let deleted = 0;
    let failed = 0;
    for (const key of candidates) {
      if (referenced.has(key)) {
        continue;
      }
      try {
        await this.storage.delete(key);
        deleted += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(`Could not delete orphan file ${key}: ${describeError(error)}`);
      }
    }
    return { deleted, failed };
  }
}
