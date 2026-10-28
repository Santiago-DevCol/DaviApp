import { DocumentFormat } from '@techdocs/shared';
import { Document } from '../../domain/document';

export const FIXTURE_IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
] as const;

export function processingDocument(
  overrides: Partial<{ id: string; fileName: string; format: DocumentFormat }> = {},
): Document {
  const format = overrides.format ?? 'md';
  return Document.create({
    id: overrides.id ?? FIXTURE_IDS[0],
    fileName: overrides.fileName ?? `manual.${format}`,
    metadata: {
      title: 'Crane manual',
      author: 'Ana Torres',
      category: 'manuals',
      tags: ['crane', 'safety'],
      version: '1.0.0',
    },
    format,
    sizeBytes: 2048,
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}
