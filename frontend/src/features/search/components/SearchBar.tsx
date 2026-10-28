import { Input } from '@/components/atoms';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  busy?: boolean;
}

export function SearchBar({ value, onChange, onClear, busy = false }: SearchBarProps) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
      <label htmlFor="search-input" className="sr-only">
        Buscar documentos
      </label>
      <Input
        id="search-input"
        type="search"
        autoComplete="off"
        autoFocus
        placeholder="Buscar en la documentación (por ejemplo: kubernetes, autenticación)…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="py-2.5 pr-20 text-base"
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        {busy && (
          <span className="text-xs text-slate-400" aria-live="polite">
            Buscando…
          </span>
        )}
        {value && !busy && (
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Limpiar
          </button>
        )}
      </div>
    </form>
  );
}
