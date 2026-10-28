export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SIZES = { sm: 'h-3.5 w-3.5 border-2', md: 'h-5 w-5 border-2', lg: 'h-8 w-8 border-[3px]' };

export function Spinner({ size = 'md', label = 'Cargando', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${SIZES[size]} ${className}`}
    />
  );
}
