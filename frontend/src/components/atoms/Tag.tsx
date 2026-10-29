export interface TagProps {
  children: string;
  onRemove?: () => void;
}

export function Tag({ children, onRemove }: TagProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar etiqueta ${children}`}
          className="grid h-6 w-6 place-items-center rounded-full hover:bg-raised focus-ring"
        >
          <span aria-hidden="true" className="block leading-none">
            &times;
          </span>
        </button>
      )}
    </span>
  );
}
