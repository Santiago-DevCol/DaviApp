import { describe, expect, it } from 'vitest';
import { parseHighlight } from './highlight';

describe('parseHighlight', () => {
  it('splits marked and plain segments in order', () => {
    expect(parseHighlight('a <mark>b</mark> … c <mark>d</mark>')).toEqual([
      { text: 'a ', marked: false },
      { text: 'b', marked: true },
      { text: ' … c ', marked: false },
      { text: 'd', marked: true },
    ]);
  });

  it('keeps any other markup as literal text', () => {
    const segments = parseHighlight('<b>x</b> <mark><i>y</i></mark>');
    expect(segments).toEqual([
      { text: '<b>x</b> ', marked: false },
      { text: '<i>y</i>', marked: true },
    ]);
  });

  it('handles empty input and unbalanced tags', () => {
    expect(parseHighlight('')).toEqual([]);
    expect(parseHighlight('<mark>open')).toEqual([{ text: 'open', marked: true }]);
    expect(parseHighlight('</mark>stray')).toEqual([{ text: 'stray', marked: false }]);
  });
});
