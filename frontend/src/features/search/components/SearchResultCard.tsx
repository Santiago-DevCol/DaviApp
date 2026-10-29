import type { SearchResultItem } from '@techdocs/shared';
import { Link, type To } from 'react-router-dom';
import { StatusDot, Tag } from '@/components/atoms';
import { parseHighlight } from '@/lib/highlight';

export interface SearchResultCardProps {
  item: SearchResultItem;
  to: To;
  /** Router state forwarded to the document page (e.g. the search params to come back to). */
  state?: unknown;
}

/**
 * Renders the highlight as React nodes: `<mark>` tokens become real `<mark>`
 * elements and everything else is plain text, so no HTML from the API is ever
 * interpreted by the browser.
 */
export function Highlight({ text }: { text: string }) {
  const segments = parseHighlight(text);
  if (segments.length === 0) return null;
  return (
    <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-soft">
      {segments.map((segment, index) =>
        segment.marked ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
      )}
    </p>
  );
}

/** One hairline-separated row of the results list. */
export function SearchResultCard({ item, to, state }: SearchResultCardProps) {
  return (
    <article className="border-t border-line py-5">
      <h3 className="text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        <Link to={to} state={state} className="text-ink hover:text-accent focus-ring">
          {item.title}
        </Link>
      </h3>
      <dl className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-label">
        <dt className="sr-only">Autor</dt>
        <dd>{item.author}</dd>
        <dt className="sr-only">Categoría</dt>
        <dd>{item.category}</dd>
        <dt className="sr-only">Versión</dt>
        <dd>v{item.version}</dd>
        <dt className="sr-only">Estado</dt>
        <dd>
          <StatusDot status={item.status} />
        </dd>
      </dl>
      <Highlight text={item.highlight} />
      {item.tags.length > 0 && (
        <ul aria-label="Etiquetas" className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
