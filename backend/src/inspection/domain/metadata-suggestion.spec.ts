import { sanitizeSuggestion, titleFromFileName } from './metadata-suggestion';

describe('sanitizeSuggestion', () => {
  it('trims, strips control characters and drops empty values', () => {
    expect(
      sanitizeSuggestion({
        title: '  Manual\u0000 de\u0007 grúa \n',
        author: '   ',
        category: undefined,
        version: 'v1.0.0\t',
        tags: [' crane ', '', '\u0001'],
      }),
    ).toEqual({ title: 'Manual de grúa', version: 'v1.0.0', tags: ['crane'] });
  });

  it('enforces the upload DTO limits: 200 chars per field, 20 tags of 50 chars', () => {
    const long = 'x'.repeat(250);
    const result = sanitizeSuggestion({
      title: long,
      author: long,
      tags: Array.from({ length: 25 }, (_, i) => `tag-${i}-${'y'.repeat(60)}`),
    });

    expect(result.title).toHaveLength(200);
    expect(result.author).toHaveLength(200);
    expect(result.tags).toHaveLength(20);
    expect(result.tags?.every((tag) => tag.length <= 50)).toBe(true);
  });

  it('accepts tags as a comma-separated string and de-duplicates them', () => {
    expect(sanitizeSuggestion({ tags: 'crane, safety,crane ,, lifting' })).toEqual({
      tags: ['crane', 'safety', 'lifting'],
    });
  });

  it('coerces scalar numbers (a YAML `version: 2.1`) to strings and ignores objects', () => {
    expect(sanitizeSuggestion({ version: 2.1, title: { nested: true }, tags: 42 })).toEqual({
      version: '2.1',
    });
  });

  it('returns an empty object when nothing usable is present', () => {
    expect(sanitizeSuggestion({})).toEqual({});
  });
});

describe('titleFromFileName', () => {
  it('strips the extension and turns separators into single spaces', () => {
    expect(titleFromFileName('crane_operating-manual__v2.1.pdf')).toBe('crane operating manual v2.1');
    expect(titleFromFileName('  Guía técnica.TXT ')).toBe('Guía técnica');
  });

  it('keeps a name without extension and returns undefined for an empty one', () => {
    expect(titleFromFileName('README')).toBe('README');
    expect(titleFromFileName('.hidden')).toBeUndefined();
    expect(titleFromFileName('')).toBeUndefined();
  });
});
