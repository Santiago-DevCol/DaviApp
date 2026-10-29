import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractHeadings } from '@/lib/markdownOutline';

export interface MarkdownBodyProps {
  content: string;
}

/**
 * Loaded lazily by `DocumentBody` so the Markdown toolchain stays out of the
 * initial bundle. No raw-HTML plugin is enabled: embedded HTML renders as text.
 * Level-2 headings receive the ids the outline links to, matched by source line
 * so the id and the link always come from the same `extractHeadings` pass.
 */
export default function MarkdownBody({ content }: MarkdownBodyProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const components = useMemo<Components>(
    () => ({
      h2: ({ node, children }) => {
        const line = node?.position?.start.line;
        const id = headings.find((heading) => heading.line === line)?.id;
        return <h2 id={id}>{children}</h2>;
      },
    }),
    [headings],
  );

  return (
    <div className="prose-doc font-reading text-[17px] leading-[1.7] text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
