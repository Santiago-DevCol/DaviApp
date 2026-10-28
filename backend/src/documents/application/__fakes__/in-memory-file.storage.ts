import { FileStorage } from '../../domain/ports/file-storage';

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();

  async save(key: string, buffer: Buffer): Promise<void> {
    this.files.set(key, Buffer.from(buffer));
  }

  async read(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`ENOENT: no such file ${key}`);
    }
    return Buffer.from(file);
  }
}
