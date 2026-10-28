import { useState, type KeyboardEvent } from 'react';
import { Tag } from '../atoms/Tag';

export interface TagsInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}

/** Chip-style tag editor: Enter or comma adds, Backspace on empty input removes the last one. */
export function TagsInput({
  id,
  value,
  onChange,
  maxTags = 20,
  disabled = false,
  describedBy,
  invalid = false,
}: TagsInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim().replace(/,+$/, '').trim();
    setDraft('');
    if (!tag || value.includes(tag) || value.length >= maxTags) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 rounded-md border bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-indigo-500 ${
        invalid ? 'border-red-400' : 'border-slate-300'
      } ${disabled ? 'bg-slate-100' : ''}`}
    >
      {value.map((tag) => (
        <Tag key={tag} onRemove={disabled ? undefined : () => onChange(value.filter((t) => t !== tag))}>
          {tag}
        </Tag>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder={value.length === 0 ? 'Añade etiquetas y pulsa Enter' : ''}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
      />
    </div>
  );
}
