import { IdGenerator } from '../../domain/ports/id-generator';

export class FixedIdGenerator implements IdGenerator {
  private cursor = 0;

  constructor(private readonly ids: readonly string[]) {}

  next(): string {
    const id = this.ids[this.cursor];
    if (id === undefined) {
      throw new Error('FixedIdGenerator ran out of ids');
    }
    this.cursor += 1;
    return id;
  }
}
