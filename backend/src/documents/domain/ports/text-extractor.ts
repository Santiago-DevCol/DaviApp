import { DocumentFormat } from '@techdocs/shared';

export interface TextExtractor {
  /** Returns the plain text of the file; throws TextExtractionError when the file cannot be parsed. */
  extract(buffer: Buffer, format: DocumentFormat): Promise<string>;
}

export const TEXT_EXTRACTOR = Symbol('TextExtractor');
