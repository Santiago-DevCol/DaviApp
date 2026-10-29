import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-ground hover:bg-accent-strong disabled:opacity-50',
  secondary: 'border border-line bg-surface text-ink hover:bg-raised disabled:text-ink-label',
  quiet: 'bg-transparent text-accent hover:bg-raised disabled:text-ink-label',
  danger: 'border border-line bg-surface text-bad hover:bg-raised disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-bold transition-colors focus-ring disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
