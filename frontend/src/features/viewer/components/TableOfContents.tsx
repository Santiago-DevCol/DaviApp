import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Heading } from '@/lib/markdownOutline';

export interface TableOfContentsProps {
  headings: Heading[];
  className?: string;
}

/** Modifier or non-primary clicks are left to the browser (new tab, download, etc.). */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** In-page anchors to the document's level-2 headings; renders nothing without them. */
export function TableOfContents({ headings, className = '' }: TableOfContentsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (headings.length === 0) return null;

  // A native fragment jump pushes a history entry with null state, which would make the
  // reader forget where it came from; replace the entry through the router instead.
  const jumpTo = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    void navigate({ hash: `#${id}` }, { replace: true, state: location.state as unknown });
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  };

  return (
    <nav aria-label="En este documento" className={className}>
      <p className="px-3 text-xs font-bold uppercase tracking-wide text-ink-label">En este documento</p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={jumpTo(heading.id)}
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
