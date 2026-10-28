import { MAX_FILE_SIZE_BYTES } from '@techdocs/shared';
import { describe, expect, it } from 'vitest';
import { normalizeMetadata, validateFile, validateMetadata } from './validation';

describe('validateFile', () => {
  it('rejects extensions outside the allow-list', () => {
    expect(validateFile({ name: 'setup.exe', size: 10 })).toMatch(/Formato no permitido/);
    expect(validateFile({ name: 'archive.tar.gz', size: 10 })).toMatch(/Formato no permitido/);
    expect(validateFile({ name: 'noextension', size: 10 })).toMatch(/Formato no permitido/);
  });

  it('rejects files above the shared size limit', () => {
    expect(validateFile({ name: 'big.pdf', size: MAX_FILE_SIZE_BYTES + 1 })).toMatch(/máximo es 10.0 MB/);
    expect(validateFile({ name: 'edge.pdf', size: MAX_FILE_SIZE_BYTES })).toBeNull();
  });

  it('rejects empty files', () => {
    expect(validateFile({ name: 'empty.txt', size: 0 })).toMatch(/vacío/);
  });

  it('accepts txt, md and pdf regardless of case', () => {
    expect(validateFile({ name: 'a.txt', size: 1 })).toBeNull();
    expect(validateFile({ name: 'b.MD', size: 1 })).toBeNull();
    expect(validateFile({ name: 'c.Pdf', size: 1 })).toBeNull();
  });
});

describe('validateMetadata', () => {
  const valid = { title: 'T', author: 'A', category: 'C', tags: ['x'], version: '1' };

  it('accepts complete metadata', () => {
    expect(validateMetadata(valid)).toEqual({});
  });

  it('requires the text fields', () => {
    const errors = validateMetadata({ ...valid, title: '  ', author: '' });
    expect(errors.title).toBeDefined();
    expect(errors.author).toBeDefined();
    expect(errors.category).toBeUndefined();
  });

  it('enforces length limits', () => {
    expect(validateMetadata({ ...valid, title: 'x'.repeat(201) }).title).toMatch(/200/);
    expect(validateMetadata({ ...valid, tags: ['y'.repeat(51)] }).tags).toMatch(/50/);
    expect(validateMetadata({ ...valid, tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }).tags).toMatch(/20/);
  });
});

describe('normalizeMetadata', () => {
  it('trims fields and deduplicates tags', () => {
    expect(
      normalizeMetadata({ title: ' T ', author: 'A ', category: ' C', version: ' 1 ', tags: [' a', 'a', '', 'b '] }),
    ).toEqual({ title: 'T', author: 'A', category: 'C', version: '1', tags: ['a', 'b'] });
  });
});
