import { formatMs } from '@/lib/format';

export const LATENCY_BUDGET_MS = 1000;

export interface SearchLatencyProps {
  tookMs: number;
}

/**
 * Shows the server-side search time as muted text; the number turns to the
 * busy tone once it exceeds the 1 s budget. It keeps its own element so the
 * value stays queryable on its own.
 */
export function SearchLatency({ tookMs }: SearchLatencyProps) {
  const over = tookMs > LATENCY_BUDGET_MS;
  return (
    <p
      className="text-[13px] text-ink-label"
      title={over ? 'Por encima del objetivo de 1 s' : 'Dentro del objetivo de 1 s'}
    >
      <span className={over ? 'text-busy' : undefined}>{formatMs(tookMs)}</span> en el motor
    </p>
  );
}
