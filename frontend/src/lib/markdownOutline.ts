export interface Heading {
  id: string;
  text: string;
  /** 1-based line in the Markdown source where the heading starts. */
  line: number;
}

const ATX_H2 = /^##\s+(.+?)\s*#*\s*$/;
const FENCE = /^(```|~~~)/;

/** Lowercase ASCII slug: diacritics removed, non-alphanumerics folded into single dashes. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Drops the inline markup a heading may carry, keeping only its visible text. */
function stripInlineMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

/**
 * Lists the level-2 ATX headings of a Markdown document, skipping fenced code
 * blocks. Ids are unique within the document (`pasos`, `pasos-2`, ...).
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  markdown.split(/\r?\n/).forEach((rawLine, index) => {
    if (FENCE.test(rawLine.trimStart())) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = ATX_H2.exec(rawLine);
    if (!match?.[1]) return;

    const text = stripInlineMarkup(match[1]).trim();
    const base = slugify(text) || 'seccion';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    headings.push({ id: count === 1 ? base : `${base}-${count}`, text, line: index + 1 });
  });

  return headings;
}
