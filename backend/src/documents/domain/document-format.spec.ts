import { resolveDocumentFormat } from './document-format';
import { UnsupportedDocumentFormatError } from './errors';

describe('resolveDocumentFormat', () => {
  it.each([
    ['notes.txt', 'text/plain', 'txt'],
    ['README.MD', 'text/markdown', 'md'],
    ['guide.pdf', 'application/pdf', 'pdf'],
    ['archive.tar.md', 'text/plain', 'md'],
  ])('resolves %s (%s) to %s', (fileName, mimeType, expected) => {
    expect(resolveDocumentFormat(fileName, mimeType)).toBe(expected);
  });

  it('accepts a generic or empty mime type when the extension is allowed', () => {
    expect(resolveDocumentFormat('spec.md', 'application/octet-stream')).toBe('md');
    expect(resolveDocumentFormat('spec.txt', '')).toBe('txt');
    expect(resolveDocumentFormat('spec.txt', undefined)).toBe('txt');
  });

  it.each([
    ['virus.exe', 'application/octet-stream'],
    ['image.png', 'image/png'],
    ['noextension', 'text/plain'],
    ['.md', 'text/markdown'],
  ])('rejects %s with an UnsupportedDocumentFormatError', (fileName, mimeType) => {
    expect(() => resolveDocumentFormat(fileName, mimeType)).toThrow(UnsupportedDocumentFormatError);
  });

  it('rejects an allowed extension declared with a disallowed mime type', () => {
    expect(() => resolveDocumentFormat('fake.pdf', 'image/png')).toThrow(
      UnsupportedDocumentFormatError,
    );
  });
});
