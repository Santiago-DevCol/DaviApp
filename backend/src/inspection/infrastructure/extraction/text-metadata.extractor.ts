import { Injectable } from '@nestjs/common';
import { DocumentFormat } from '@techdocs/shared';
import {
  fileNameFallback,
  MetadataInspection,
  sanitizeSuggestion,
} from '../../domain/metadata-suggestion';
import { MetadataExtractor } from '../../domain/ports/metadata-extractor';

/** Longer first lines are paragraphs, not titles. */
export const MAX_HEURISTIC_TITLE_LENGTH = 120;

/**
 * Plain text carries no metadata, so the first non-empty line is offered as a
 * heuristic title when it is short enough to plausibly be one.
 */
@Injectable()
export class TextMetadataExtractor implements MetadataExtractor {
  async inspect(buffer: Buffer, _format: DocumentFormat, fileName: string): Promise<MetadataInspection> {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0);
    const title = sanitizeSuggestion({ title: firstLine }).title;

    if (title && title.length <= MAX_HEURISTIC_TITLE_LENGTH) {
      return { source: 'heuristic', suggested: { title } };
    }
    return fileNameFallback(fileName);
  }
}
