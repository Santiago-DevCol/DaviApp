import { FileStorage } from '../../domain/ports/file-storage';

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();
  readonly modifiedAt = new Map<string, Date>();
  readonly deleted: string[] = [];
  private deleteFailure: Error | null = null;
  private readonly deleteFailuresByKey = new Map<string, Error>();

  async save(key: string, buffer: Buffer): Promise<void> {
    this.files.set(key, Buffer.from(buffer));
    this.modifiedAt.set(key, new Date());
  }

  async read(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`ENOENT: no such file ${key}`);
    }
    return Buffer.from(file);
  }

  async delete(key: string): Promise<void> {
    const keyFailure = this.deleteFailuresByKey.get(key);
    if (keyFailure) {
      throw keyFailure;
    }
    if (this.deleteFailure) {
      throw this.deleteFailure;
    }
    this.files.delete(key);
    this.modifiedAt.delete(key);
    this.deleted.push(key);
  }

  async listKeysOlderThan(olderThan: Date): Promise<string[]> {
    return [...this.modifiedAt.entries()]
      .filter(([, at]) => at.getTime() < olderThan.getTime())
      .map(([key]) => key);
  }

  /** Test helpers. */
  seed(key: string, buffer: Buffer, modifiedAt: Date): void {
    this.files.set(key, Buffer.from(buffer));
    this.modifiedAt.set(key, modifiedAt);
  }

  failDeleteOfKeyWith(key: string, error: Error): void {
    this.deleteFailuresByKey.set(key, error);
  }

  failDeleteWith(error: Error): void {
    this.deleteFailure = error;
  }
}
