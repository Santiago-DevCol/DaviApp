import { DocumentStatus } from '@techdocs/shared';
import { Document } from './document';
import { DocumentStateError } from './errors';

function createProcessingDocument(): Document {
  return Document.create({
    id: '11111111-1111-4111-8111-111111111111',
    fileName: 'manual.md',
    metadata: {
      title: 'Crane manual',
      author: 'Ana',
      category: 'manuals',
      tags: ['crane', 'safety'],
      version: '1.0.0',
    },
    format: 'md',
    sizeBytes: 1234,
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('Document', () => {
  it('is created in PROCESSING state with a storage key derived from id and format', () => {
    const document = createProcessingDocument();

    expect(document.status).toBe(DocumentStatus.PROCESSING);
    expect(document.storageKey).toBe('11111111-1111-4111-8111-111111111111.md');
    expect(document.content).toBeNull();
    expect(document.errorMessage).toBeNull();
    expect(document.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(document.updatedAt).toEqual(document.createdAt);
  });

  it('transitions PROCESSING -> INDEXED storing the extracted content', () => {
    const document = createProcessingDocument();
    const at = new Date('2026-01-01T00:00:05.000Z');

    document.markIndexed('Extracted text', at);

    expect(document.status).toBe(DocumentStatus.INDEXED);
    expect(document.content).toBe('Extracted text');
    expect(document.errorMessage).toBeNull();
    expect(document.updatedAt).toEqual(at);
  });

  it('transitions PROCESSING -> ERROR storing the failure reason', () => {
    const document = createProcessingDocument();

    document.markFailed('No extractable text found');

    expect(document.status).toBe(DocumentStatus.ERROR);
    expect(document.errorMessage).toBe('No extractable text found');
    expect(document.content).toBeNull();
  });

  it.each([
    ['INDEXED', (d: Document) => d.markIndexed('x')],
    ['ERROR', (d: Document) => d.markFailed('boom')],
  ])('rejects any transition out of a terminal %s state', (_state, reach) => {
    const document = createProcessingDocument();
    reach(document);

    expect(() => document.markIndexed('again')).toThrow(DocumentStateError);
    expect(() => document.markFailed('again')).toThrow(DocumentStateError);
  });

  it('reports whether it is still processing', () => {
    const document = createProcessingDocument();
    expect(document.isProcessing()).toBe(true);

    document.markIndexed('done');
    expect(document.isProcessing()).toBe(false);
  });
});
