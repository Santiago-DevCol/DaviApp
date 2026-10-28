import type { DocumentFormat } from '@techdocs/shared';
import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms';

const MarkdownBody = lazy(() => import('./MarkdownBody'));

export interface DocumentBodyProps {
  format: DocumentFormat;
  content: string;
}

/**
 * Markdown goes through react-markdown (code-split); txt and extracted PDF
 * text are shown pre-wrapped.
 */
export function DocumentBody({ format, content }: DocumentBodyProps) {
  if (format === 'md') {
    return (
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner size="sm" /> Preparando vista…
          </div>
        }
      >
        <MarkdownBody content={content} />
      </Suspense>
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
      {content}
    </pre>
  );
}
