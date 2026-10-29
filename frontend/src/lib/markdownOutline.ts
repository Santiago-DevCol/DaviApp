export interface Heading {
  id: string;
  text: string;
  /** 1-based line in the Markdown source where the heading starts. */
  line: number;
}

/** `## text`, optionally closed by a `#` run that must be preceded by whitespace (CommonMark). */
const ATX_H2 = /^##[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
/** Opening fence: three or more backticks or tildes, with anything after (the info string). */
const FENCE_OPEN = /^(`{3,}|~{3,})/;

interface Fence {
  char: string;
  length: number;
}

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

/** A fence closes only with the same character, at least as long as the opener, and nothing else. */
function closesFence(line: string, fence: Fence): boolean {
  const trimmed = line.trimEnd();
  return trimmed.length >= fence.length && /^(.)\1*$/.test(trimmed) && trimmed[0] === fence.char;
}

/** First id in the `base`, `base-2`, `base-3`, ... sequence that no earlier heading took. */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

/**
 * Lists the level-2 ATX headings of a Markdown document, skipping fenced code
 * blocks. Ids are unique within the document (`pasos`, `pasos-2`, ...).
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const used = new Set<string>();
  let fence: Fence | null = null;

  markdown.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trimStart();
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      return;
    }
    const opener = FENCE_OPEN.exec(line)?.[1];
    if (opener) {
      fence = { char: opener[0] as string, length: opener.length };
      return;
    }

    const match = ATX_H2.exec(rawLine);
    if (!match?.[1]) return;

    const text = stripInlineMarkup(match[1]).trim();
    const base = slugify(text) || 'seccion';
    headings.push({ id: uniqueId(base, used), text, line: index + 1 });
  });

  return headings;
}
