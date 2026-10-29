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
      className={`rounded-lg border bg-white p-4 ${fileError ? 'border-red-300' : 'border-slate-200'}`}
    >
      <legend className="sr-only">Metadatos de {fileName}</legend>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-slate-500">
            {formatBytes(sizeBytes)}
            {pages !== undefined && (
              <>
                {' · '}
                <span>{formatPages(pages)}</span>
              </>
            )}
          </p>
          {inspection === 'pending' && (
            <p role="status" className="text-xs text-slate-400">
              Analizando archivos…
            </p>
          )}
          {inspection === 'failed' && (
            <p role="status" className="text-xs text-amber-700">
              No se pudieron sugerir metadatos
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
          Quitar
        </Button>
      </div>

      {fileError && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          {fileError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="sm:col-span-2">
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
