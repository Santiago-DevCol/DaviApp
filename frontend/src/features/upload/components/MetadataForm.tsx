import type { DocumentMetadataInput } from '@techdocs/shared';
import { Button, Input } from '@/components/atoms';
import { FormField, describedBy } from '@/components/molecules';
import { TagsInput } from '@/components/molecules/TagsInput';
import { formatBytes } from '@/lib/format';
import type { MetadataErrors } from '../validation';

export const CATEGORY_SUGGESTIONS = [
  'Arquitectura',
  'API',
  'Guía',
  'Manual',
  'Especificación',
  'Infraestructura',
  'Seguridad',
  'Otro',
];

export interface MetadataFormProps {
  formId: string;
  fileName: string;
  sizeBytes: number;
  value: DocumentMetadataInput;
  errors: MetadataErrors;
  /** Client-side file validation error; the file will not be sent. */
  fileError?: string | null;
  disabled?: boolean;
  onChange: (value: DocumentMetadataInput) => void;
  onRemove: () => void;
}

export function MetadataForm({
  formId,
  fileName,
  sizeBytes,
  value,
  errors,
  fileError,
  disabled = false,
  onChange,
  onRemove,
}: MetadataFormProps) {
  const field = (name: keyof DocumentMetadataInput) => `${formId}-${name}`;
  const update = (patch: Partial<DocumentMetadataInput>) => onChange({ ...value, ...patch });
  const datalistId = `${formId}-categories`;

  return (
    <fieldset
      disabled={disabled}
      className={`flex flex-col gap-4 rounded-xl border bg-surface p-5 ${fileError ? 'border-bad' : 'border-line'}`}
    >
      <legend className="sr-only">Metadatos de {fileName}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink" title={fileName}>
            {fileName}
          </p>
          <p className="text-[13px] text-ink-label">{formatBytes(sizeBytes)}</p>
        </div>
        <Button variant="quiet" onClick={onRemove} disabled={disabled}>
          Quitar
        </Button>
      </div>

      {fileError && (
        <p role="alert" className="text-[13px] text-bad">
          {fileError}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField id={field('title')} label="Título" required error={errors.title}>
            <Input
              id={field('title')}
              value={value.title}
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy(field('title'), errors.title)}
              onChange={(event) => update({ title: event.target.value })}
              maxLength={200}
            />
          </FormField>
        </div>
        <FormField id={field('author')} label="Autor" required error={errors.author}>
          <Input
            id={field('author')}
            value={value.author}
            invalid={Boolean(errors.author)}
            aria-describedby={describedBy(field('author'), errors.author)}
            onChange={(event) => update({ author: event.target.value })}
            maxLength={200}
          />
        </FormField>
        <FormField
          id={field('category')}
          label="Categoría"
          required
          error={errors.category}
          hint="Elige una sugerencia o escribe la tuya."
        >
          <Input
            id={field('category')}
            list={datalistId}
            value={value.category}
            invalid={Boolean(errors.category)}
            aria-describedby={describedBy(field('category'), errors.category, 'hint')}
            onChange={(event) => update({ category: event.target.value })}
            maxLength={200}
          />
          <datalist id={datalistId}>
            {CATEGORY_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </FormField>
        <FormField id={field('version')} label="Versión" required error={errors.version}>
          <Input
            id={field('version')}
            value={value.version}
            invalid={Boolean(errors.version)}
            aria-describedby={describedBy(field('version'), errors.version)}
            onChange={(event) => update({ version: event.target.value })}
            placeholder="1.0.0"
            maxLength={200}
          />
        </FormField>
        <div className="md:col-span-2">
          <FormField id={field('tags')} label="Etiquetas" error={errors.tags}>
            <TagsInput
              id={field('tags')}
              value={value.tags}
              onChange={(tags) => update({ tags })}
              disabled={disabled}
              invalid={Boolean(errors.tags)}
              describedBy={describedBy(field('tags'), errors.tags)}
            />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
