import { Injectable } from '@nestjs/common';
import { DocumentFormat } from '@techdocs/shared';
import { PDFParse } from 'pdf-parse';
import {
  fileNameFallback,
  MetadataInspection,
  sanitizeSuggestion,
} from '../../domain/metadata-suggestion';
import { MetadataExtractor } from '../../domain/ports/metadata-extractor';

/**
 * Reads the PDF info dictionary through pdf-parse 2.x (`PDFParse#getInfo`):
 * `info.Title` and `info.Author` become the suggestion, `total` the page
 * count. Subject/Keywords are deliberately ignored: they rarely map to the
 * catalogue's category/tags and would produce noisy suggestions. A PDF that
 * cannot be parsed degrades to the file-name fallback without a page count.
 */
@Injectable()
export class PdfMetadataExtractor implements MetadataExtractor {
  async inspect(buffer: Buffer, _format: DocumentFormat, fileName: string): Promise<MetadataInspection> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getInfo();
      const info = (result.info ?? {}) as { Title?: unknown; Author?: unknown };
      const suggested = sanitizeSuggestion({ title: info.Title, author: info.Author });
      const pages = Number.isInteger(result.total) && result.total > 0 ? result.total : undefined;

      if (!suggested.title && !suggested.author) {
        return fileNameFallback(fileName, pages);
      }
      return {
        source: 'pdf-info',
        ...(pages !== undefined ? { pages } : {}),
        suggested: suggested.title ? suggested : { ...suggested, ...fileNameTitle(fileName) },
      };
    } catch {
      return fileNameFallback(fileName);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
}

function fileNameTitle(fileName: string): { title?: string } {
  const { title } = fileNameFallback(fileName).suggested;
  return title ? { title } : {};
}
