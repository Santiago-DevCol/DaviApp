import type { DocumentStatus } from '@techdocs/shared';
import { presentStatus, type StatusTone } from '@/lib/status';

export interface StatusDotProps {
  status?: DocumentStatus;
  /** Overrides the word derived from `status`; required when no status is given. */
  label?: string;
  /** Overrides the tone derived from `status`. */
  tone?: StatusTone | 'neutral';
  className?: string;
}

const DOT: Record<StatusTone | 'neutral', string> = {
  info: 'bg-busy',
  success: 'bg-ok',
  danger: 'bg-bad',
  neutral: 'bg-ink-label',
};

/** An 8 px dot plus a sentence-case word; the dot is decorative, the word carries the meaning. */
export function StatusDot({ status, label, tone, className = '' }: StatusDotProps) {
  const presentation = status ? presentStatus(status) : null;
  const text = label ?? presentation?.label;
  if (!text) return null;
  const dotTone = tone ?? presentation?.tone ?? 'neutral';

  return (
    <span className={`inline-flex items-center gap-2 text-[13px] text-ink-soft ${className}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[dotTone]}`} />
      {text}
    </span>
  );
}
