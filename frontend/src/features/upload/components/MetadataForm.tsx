import type { DocumentMetadataInput } from '@techdocs/shared';
import { Button, Input } from '@/components/atoms';
import { FormField, describedBy } from '@/components/molecules';
import { TagsInput } from '@/components/molecules/TagsInput';
import { formatBytes } from '@/lib/format';
import {
  formatPages,
  suggestionHint,
  type InspectionState,
  type MetadataField,
  type SuggestedFields,
} from '../suggestions';
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
  /** Page count reported by the inspection (PDFs). */
  pages?: number;
  /** Metadata inspection progress; `pending` and `failed` render a non-blocking note. */
  inspection?: InspectionState;
  /** Fields currently holding an inspection suggestion, with its source. */
  suggestedFrom?: SuggestedFields;
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
  pages,
  inspection,
  suggestedFrom = {},
  disabled = false,
  onChange,
  onRemove,
}: MetadataFormProps) {
  const field = (name: MetadataField) => `${formId}-${name}`;
  const update = (patch: Partial<DocumentMetadataInput>) => onChange({ ...value, ...patch });
  const datalistId = `${formId}-categories`;
  const hint = (name: MetadataField, fallback?: string) => suggestionHint(suggestedFrom[name]) ?? fallback;
  const categoryHint = hint('category', 'Elige una sugerencia o escribe la tuya.');

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
          <p className="text-[13px] text-ink-label">
            {formatBytes(sizeBytes)}
            {pages !== undefined && (
              <>
                {' · '}
                <span>{formatPages(pages)}</span>
              </>
            )}
          </p>
          {inspection === 'pending' && (
            <p role="status" className="text-[13px] text-ink-label">
              Analizando archivos…
            </p>
          )}
          {inspection === 'failed' && (
            <p role="status" className="text-[13px] text-busy">
              No se pudieron sugerir metadatos
            </p>
          )}
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
          <FormField id={field('title')} label="Título" required error={errors.title} hint={hint('title')}>
            <Input
              id={field('title')}
              value={value.title}
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy(field('title'), errors.title, hint('title'))}
              onChange={(event) => update({ title: event.target.value })}
              maxLength={200}
            />
          </FormField>
        </div>
        <FormField id={field('author')} label="Autor" required error={errors.author} hint={hint('author')}>
          <Input
            id={field('author')}
            value={value.author}
            invalid={Boolean(errors.author)}
            aria-describedby={describedBy(field('author'), errors.author, hint('author'))}
            onChange={(event) => update({ author: event.target.value })}
            maxLength={200}
          />
        </FormField>
        <FormField
          id={field('category')}
          label="Categoría"
          required
          error={errors.category}
          hint={categoryHint}
        >
          <Input
            id={field('category')}
            list={datalistId}
            value={value.category}
            invalid={Boolean(errors.category)}
            aria-describedby={describedBy(field('category'), errors.category, categoryHint)}
            onChange={(event) => update({ category: event.target.value })}
            maxLength={200}
          />
          <datalist id={datalistId}>
            {CATEGORY_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </FormField>
        <FormField id={field('version')} label="Versión" required error={errors.version} hint={hint('version')}>
          <Input
            id={field('version')}
            value={value.version}
            invalid={Boolean(errors.version)}
            aria-describedby={describedBy(field('version'), errors.version, hint('version'))}
            onChange={(event) => update({ version: event.target.value })}
            placeholder="1.0.0"
            maxLength={200}
          />
        </FormField>
        <div className="md:col-span-2">
          <FormField id={field('tags')} label="Etiquetas" error={errors.tags} hint={hint('tags')}>
            <TagsInput
              id={field('tags')}
              value={value.tags}
              onChange={(tags) => update({ tags })}
              disabled={disabled}
              invalid={Boolean(errors.tags)}
              describedBy={describedBy(field('tags'), errors.tags, hint('tags'))}
            />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
