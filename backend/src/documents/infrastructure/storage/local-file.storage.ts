import { Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { FileStorage } from '../../domain/ports/file-storage';

/** Keys are always `<uuid>.<ext>`; anything else is refused before touching the filesystem. */
const SAFE_KEY = /^[A-Za-z0-9-]+\.[a-z0-9]{1,8}$/;

export class LocalFileStorage implements FileStorage, OnModuleInit {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    this.logger.log(`Storing uploaded files under ${this.rootDir}`);
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(this.resolve(key), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  /**
   * Only files whose name is a valid storage key are reported, so a stray file
   * someone dropped in the directory is never deleted by the orphan sweep.
   */
  async listKeysOlderThan(olderThan: Date): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.rootDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const keys: string[] = [];
    for (const name of names) {
      if (!SAFE_KEY.test(name)) {
        continue;
      }
      const info = await stat(path.join(this.rootDir, name)).catch(() => null);
      if (info?.isFile() && info.mtimeMs < olderThan.getTime()) {
        keys.push(name);
      }
    }
    return keys;
  }

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    const fullPath = path.resolve(this.rootDir, key);
    if (path.dirname(fullPath) !== this.rootDir) {
      throw new Error(`Storage key escapes the storage directory: ${key}`);
    }
    return fullPath;
  }
}
