import { describe, expect, it } from 'vitest';
import { extractHeadings, slugify } from './markdownOutline';

describe('slugify', () => {
  it('strips diacritics, lowercases and joins words with dashes', () => {
    expect(slugify('Instalación en Kubernetes 1.30')).toBe('instalacion-en-kubernetes-1-30');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  ¿Qué hacer?  ')).toBe('que-hacer');
  });
});

describe('extractHeadings', () => {
  it('keeps only level-2 headings', () => {
    const markdown = ['# Título', '', '## Instalación', '', '### Detalle', '', '## Uso'].join('\n');
    expect(extractHeadings(markdown)).toEqual([
      { id: 'instalacion', text: 'Instalación', line: 3 },
      { id: 'uso', text: 'Uso', line: 7 },
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    const markdown = ['## Real', '```bash', '## no es un título', '```', '~~~', '## tampoco', '~~~', '## Otro'].join(
      '\n',
    );
    expect(extractHeadings(markdown).map((heading) => heading.text)).toEqual(['Real', 'Otro']);
  });

  it('strips inline markup from the heading text', () => {
    const markdown = '## **Negrita** y *cursiva* con `código` y [enlace](https://example.com)';
    expect(extractHeadings(markdown)).toEqual([
      { id: 'negrita-y-cursiva-con-codigo-y-enlace', text: 'Negrita y cursiva con código y enlace', line: 1 },
    ]);
  });

  it('drops closing hashes from the heading text', () => {
    expect(extractHeadings('## Cierre ##')).toEqual([{ id: 'cierre', text: 'Cierre', line: 1 }]);
  });

  it('deduplicates ids with numeric suffixes', () => {
    const markdown = ['## Pasos', '', '## Pasos', '', '## Pasos'].join('\n');
    expect(extractHeadings(markdown).map((heading) => heading.id)).toEqual(['pasos', 'pasos-2', 'pasos-3']);
  });

  it('returns an empty list when there is no level-2 heading', () => {
    expect(extractHeadings('# Solo título\n\nTexto.')).toEqual([]);
    expect(extractHeadings('')).toEqual([]);
  });
});
