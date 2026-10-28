export interface TagProps {
  children: string;
  onRemove?: () => void;
}

export function Tag({ children, onRemove }: TagProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar etiqueta ${children}`}
          className="rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span aria-hidden="true" className="block px-0.5 leading-none">
            &times;
          </span>
        </button>
      )}
    </span>
  );
}
