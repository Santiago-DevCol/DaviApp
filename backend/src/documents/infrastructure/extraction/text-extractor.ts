import { Injectable } from '@nestjs/common';
import { DocumentFormat } from '@techdocs/shared';
import { PDFParse } from 'pdf-parse';
import { TextExtractionError } from '../../domain/errors';
import { TextExtractor } from '../../domain/ports/text-extractor';

/**
 * Plain-text formats are decoded as UTF-8; PDFs go through pdf-parse (pdf.js).
 * The output is normalized so it can be stored in a PostgreSQL `text` column
 * (which rejects NUL bytes) and indexed without noise.
 */
@Injectable()
export class FileTextExtractor implements TextExtractor {
  async extract(buffer: Buffer, format: DocumentFormat): Promise<string> {
    const raw = format === 'pdf' ? await this.extractPdf(buffer) : buffer.toString('utf8');
    return normalizeExtractedText(raw);
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      // `pageJoiner: ''` removes the default "-- 1 of N --" markers, which would
      // otherwise make an image-only PDF look like it contains text.
      const result = await parser.getText({ pageJoiner: '' });
      return result.text;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TextExtractionError(`Could not parse PDF: ${reason}`, { cause: error });
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
}

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
