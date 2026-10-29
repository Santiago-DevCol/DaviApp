import { Injectable } from '@nestjs/common';
import { DocumentFormat } from '@techdocs/shared';
import matter from 'gray-matter';
import {
  fileNameFallback,
  MetadataInspection,
  RawSuggestion,
  sanitizeSuggestion,
} from '../../domain/metadata-suggestion';
import { MetadataExtractor } from '../../domain/ports/metadata-extractor';

/** First ATX H1 (`# Title`), allowing leading blank lines and closing hashes. */
const H1_PATTERN = /^[ \t]{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/m;

/**
 * Markdown: YAML front matter wins (`title`, `author`, `version`, `category`,
 * `tags` as a list or comma-separated string); otherwise the first H1 is a
 * heuristic title. Malformed YAML is treated as "no front matter".
 */
@Injectable()
export class MarkdownMetadataExtractor implements MetadataExtractor {
  async inspect(buffer: Buffer, _format: DocumentFormat, fileName: string): Promise<MetadataInspection> {
    const text = buffer.toString('utf8').replace(/^﻿/, '');

    const { data, content } = parseFrontMatter(text);
    const suggested = sanitizeSuggestion(data);
    if (Object.keys(suggested).length > 0) {
      return { source: 'front-matter', suggested };
    }

    const heading = sanitizeSuggestion({ title: H1_PATTERN.exec(content)?.[1] }).title;
    if (heading) {
      return { source: 'heuristic', suggested: { title: heading } };
    }
    return fileNameFallback(fileName);
  }
}

function parseFrontMatter(text: string): { data: RawSuggestion; content: string } {
  try {
    const parsed = matter(text);
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    return {
      data: {
        title: data.title,
        author: data.author,
        category: data.category,
        tags: data.tags,
        version: data.version,
      },
      content: parsed.content,
    };
  } catch {
    // Invalid YAML: skip the front matter block so the body heuristics still run.
    return { data: {}, content: text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '') };
  }
}
