import { buildDocumentKey } from './document-key';

describe('buildDocumentKey', () => {
  it('joins normalized title and author with a pipe', () => {
    expect(buildDocumentKey('Crane manual', 'Ana Torres')).toBe('crane manual|ana torres');
  });

  it('lowercases, strips diacritics, trims and collapses whitespace', () => {
    expect(buildDocumentKey('  Guía Técnica  de Grúas ', 'José\tPérez')).toBe(
      'guia tecnica de gruas|jose perez',
    );
  });

  it('treats a typo in the title as a different identity', () => {
    expect(buildDocumentKey('Crane manual', 'Ana')).not.toBe(buildDocumentKey('Crane manuel', 'Ana'));
  });

  it('keeps the ñ distinct from n (only combining marks are removed)', () => {
    expect(buildDocumentKey('Año', 'x')).toBe('ano|x');
  });
});
