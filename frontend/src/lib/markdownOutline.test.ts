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

  it('tracks the opening fence so a shorter inner fence does not close it', () => {
    const markdown = ['````md', '```', '## Falso', '```', '````', '', '## Real'].join('\n');
    expect(extractHeadings(markdown)).toEqual([{ id: 'real', text: 'Real', line: 7 }]);
  });

  it('does not close a backtick fence with a tilde line', () => {
    const markdown = ['```', '~~~', '## Falso', '```', '## Real'].join('\n');
    expect(extractHeadings(markdown)).toEqual([{ id: 'real', text: 'Real', line: 5 }]);
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

  it('keeps a trailing hash that is part of the text', () => {
    expect(extractHeadings('## C#')).toEqual([{ id: 'c', text: 'C#', line: 1 }]);
    expect(extractHeadings('## Uso de C#').map((heading) => heading.text)).toEqual(['Uso de C#']);
  });

  it('deduplicates ids with numeric suffixes', () => {
    const markdown = ['## Pasos', '', '## Pasos', '', '## Pasos'].join('\n');
    expect(extractHeadings(markdown).map((heading) => heading.id)).toEqual(['pasos', 'pasos-2', 'pasos-3']);
  });

  it('never emits an id that an earlier heading already produced', () => {
    const markdown = ['## Pasos', '', '## Pasos 2', '', '## Pasos'].join('\n');
    expect(extractHeadings(markdown).map((heading) => heading.id)).toEqual(['pasos', 'pasos-2', 'pasos-3']);
  });

  it('returns an empty list when there is no level-2 heading', () => {
    expect(extractHeadings('# Solo título\n\nTexto.')).toEqual([]);
    expect(extractHeadings('')).toEqual([]);
  });
});
