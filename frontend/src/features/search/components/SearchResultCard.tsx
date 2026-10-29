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
    <p className="text-sm leading-relaxed text-slate-700">
      {segments.map((segment, index) =>
        segment.marked ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
      )}
    </p>
  );
}

export function SearchResultCard({ item, to, state }: SearchResultCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug">
          <Link
            to={to}
            state={state}
            className="text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {item.title}
          </Link>
        </h3>
        <StatusDot status={item.status} />
      </header>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <div>
          <dt className="sr-only">Autor</dt>
          <dd>{item.author}</dd>
        </div>
        <div>
          <dt className="sr-only">Categoría</dt>
          <dd>{item.category}</dd>
        </div>
        <div>
          <dt className="sr-only">Versión</dt>
          <dd>v{item.version}</dd>
        </div>
      </dl>
      <div className="mt-2">
        <Highlight text={item.highlight} />
      </div>
      {item.tags.length > 0 && (
        <ul aria-label="Etiquetas" className="mt-3 flex flex-wrap gap-1">
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
