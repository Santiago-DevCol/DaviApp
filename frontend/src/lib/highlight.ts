export interface HighlightSegment {
  text: string;
  marked: boolean;
}

const MARK_TOKEN = /<\/?mark>/g;

/**
 * Splits a search highlight such as `foo <mark>bar</mark> … baz` into plain
 * segments. Only the literal `<mark>`/`</mark>` tokens are interpreted; any
 * other markup stays as text, so the result can be rendered as React nodes
 * without ever touching `dangerouslySetInnerHTML`.
 */
export function parseHighlight(highlight: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let marked = false;
  let cursor = 0;

  for (const match of highlight.matchAll(MARK_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ text: highlight.slice(cursor, index), marked });
    }
    marked = match[0] === '<mark>';
    cursor = index + match[0].length;
  }
  if (cursor < highlight.length) {
    segments.push({ text: highlight.slice(cursor), marked });
  }
  return segments;
}
