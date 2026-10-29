import { Input } from '@/components/atoms';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  busy?: boolean;
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function SearchBar({ value, onChange, onClear, busy = false }: SearchBarProps) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2">
      <label htmlFor="search-input" className="text-[13px] font-bold text-ink-label">
        Término de búsqueda
      </label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-label">
          <svg {...ICON_PROPS} width={20} height={20}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <Input
          id="search-input"
          type="search"
          autoComplete="off"
          autoFocus
          placeholder="Por ejemplo: kubernetes, autenticación…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 pl-12 pr-14 text-[17px]"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={onClear}
            className="absolute inset-y-0 right-1.5 my-auto grid h-11 w-11 place-items-center rounded-lg text-ink-soft hover:bg-raised focus-ring"
          >
            <svg {...ICON_PROPS} width={18} height={18}>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
      {busy && (
        <span aria-live="polite" className="text-[13px] text-ink-label">
          Buscando…
        </span>
      )}
    </form>
  );
}
