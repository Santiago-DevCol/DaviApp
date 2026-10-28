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
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <p className="text-sm font-medium text-slate-800">Arrastra tus archivos aquí</p>
      <p className="text-xs text-slate-500">o</p>
      <label
        htmlFor={inputId}
        className={`inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500 ${
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
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
