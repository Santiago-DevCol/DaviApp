import { DocumentFormat } from '@techdocs/shared';
import { TextExtractor } from '../../domain/ports/text-extractor';

type Behaviour = { text: string } | { error: Error };

export class FakeTextExtractor implements TextExtractor {
  readonly calls: Array<{ buffer: Buffer; format: DocumentFormat }> = [];
  private behaviour: Behaviour = { text: '' };

  returns(text: string): this {
    this.behaviour = { text };
    return this;
  }

  throws(error: Error): this {
    this.behaviour = { error };
    return this;
  }

  async extract(buffer: Buffer, format: DocumentFormat): Promise<string> {
    this.calls.push({ buffer, format });
    if ('error' in this.behaviour) {
      throw this.behaviour.error;
    }
    return this.behaviour.text;
  }
}
