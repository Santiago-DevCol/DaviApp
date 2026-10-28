import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MarkdownBodyProps {
  content: string;
}

/**
 * Loaded lazily by `DocumentBody` so the Markdown toolchain stays out of the
 * initial bundle. No raw-HTML plugin is enabled: embedded HTML renders as text.
 */
export default function MarkdownBody({ content }: MarkdownBodyProps) {
  return (
    <div className="prose-doc text-sm text-slate-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
