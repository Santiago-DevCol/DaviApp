import { Injectable } from '@nestjs/common';
import { DocumentFormat } from '@techdocs/shared';
import { MetadataInspection } from '../../domain/metadata-suggestion';
import { MetadataExtractor } from '../../domain/ports/metadata-extractor';
import { MarkdownMetadataExtractor } from './markdown-metadata.extractor';
import { PdfMetadataExtractor } from './pdf-metadata.extractor';
import { TextMetadataExtractor } from './text-metadata.extractor';

/** Picks the extractor for the already-resolved document format. */
@Injectable()
export class FormatDispatchingMetadataExtractor implements MetadataExtractor {
  private readonly byFormat: Record<DocumentFormat, MetadataExtractor>;

  constructor(pdf: PdfMetadataExtractor, markdown: MarkdownMetadataExtractor, text: TextMetadataExtractor) {
    this.byFormat = { pdf, md: markdown, txt: text };
  }

  inspect(buffer: Buffer, format: DocumentFormat, fileName: string): Promise<MetadataInspection> {
    return this.byFormat[format].inspect(buffer, format, fileName);
  }
}
