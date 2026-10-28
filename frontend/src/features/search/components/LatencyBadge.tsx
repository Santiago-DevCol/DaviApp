import { Badge } from '@/components/atoms';
import { formatMs } from '@/lib/format';

export const LATENCY_BUDGET_MS = 1000;

export interface LatencyBadgeProps {
  tookMs: number;
}

/** Shows the server-side search time; amber once it exceeds the 1 s budget. */
export function LatencyBadge({ tookMs }: LatencyBadgeProps) {
  const withinBudget = tookMs <= LATENCY_BUDGET_MS;
  return (
    <Badge
      tone={withinBudget ? 'success' : 'warning'}
      title={withinBudget ? 'Dentro del objetivo de 1 s' : 'Por encima del objetivo de 1 s'}
    >
      {formatMs(tookMs)}
    </Badge>
  );
}
