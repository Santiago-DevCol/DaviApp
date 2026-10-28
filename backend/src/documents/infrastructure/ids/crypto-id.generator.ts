import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../../domain/ports/id-generator';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
