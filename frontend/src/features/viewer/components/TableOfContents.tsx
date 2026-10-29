import type { Heading } from '@/lib/markdownOutline';

export interface TableOfContentsProps {
  headings: Heading[];
  className?: string;
}

/** In-page anchors to the document's level-2 headings; renders nothing without them. */
export function TableOfContents({ headings, className = '' }: TableOfContentsProps) {
  if (headings.length === 0) return null;
  return (
    <nav aria-label="En este documento" className={className}>
      <p className="px-3 text-xs font-bold uppercase tracking-wide text-ink-label">En este documento</p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className="block rounded-lg px-3 py-1.5 text-[13px] text-ink-soft hover:bg-raised hover:text-ink focus-ring"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
