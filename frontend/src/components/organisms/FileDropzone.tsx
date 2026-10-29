import { useId, useRef, useState, type DragEvent } from 'react';

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept: string;
  disabled?: boolean;
  hint?: string;
}

/** Drag-and-drop area with an equivalent keyboard-accessible file picker. */
export function FileDropzone({ onFiles, accept, disabled = false, hint }: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    emit(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${
        dragging ? 'border-accent bg-raised' : 'border-dropzone bg-surface'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <p className="text-ink">Arrastra tus archivos aquí o</p>
      {/* The label is the visible control; its only text node must stay exactly "Seleccionar archivos". */}
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 text-[15px] font-bold text-ink hover:bg-raised focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          disabled ? 'pointer-events-none' : ''
        }`}
      >
        Seleccionar archivos
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            emit(event.target.files);
            // Allow picking the same file again after removing it.
            event.target.value = '';
          }}
        />
      </label>
      {hint && <p className="text-[13px] text-ink-label">{hint}</p>}
    </div>
  );
}
