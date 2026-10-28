import type { ReactNode } from 'react';
import type { StatusTone } from '@/lib/status';

export type BadgeTone = StatusTone | 'neutral' | 'warning';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = 'neutral', children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
