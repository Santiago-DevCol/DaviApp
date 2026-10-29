import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** 44 px by default; an `h-*` class in `extra` replaces that height instead of competing with it. */
export const inputClassName = (invalid = false, extra = '') => {
  const height = /(^|\s)h-\S+/.test(extra) ? '' : 'h-11';
  return `block ${height} w-full rounded-lg border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-label focus-ring disabled:bg-raised ${
    invalid ? 'border-bad' : 'border-edge'
  } ${extra}`;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={inputClassName(invalid, className)}
      {...rest}
    />
  );
});
