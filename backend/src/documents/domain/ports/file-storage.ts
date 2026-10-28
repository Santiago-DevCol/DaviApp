export interface FileStorage {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}

export const FILE_STORAGE = Symbol('FileStorage');
