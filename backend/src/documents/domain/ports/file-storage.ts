export interface FileStorage {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Removes the file; a missing key is not an error. */
  delete(key: string): Promise<void>;
  /** Keys of stored files last modified before `olderThan` (orphan sweep input). */
  listKeysOlderThan(olderThan: Date): Promise<string[]>;
}

export const FILE_STORAGE = Symbol('FileStorage');
