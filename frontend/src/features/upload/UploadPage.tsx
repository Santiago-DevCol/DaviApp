import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  type DocumentMetadataInput,
  type UploadAcceptedItem,
} from '@techdocs/shared';
import { useCallback, useMemo, useState } from 'react';
import { describeError } from '@/api/client';
import { FileDropzone } from '@/components/organisms/FileDropzone';
import { Button } from '@/components/atoms';
import { ErrorState } from '@/components/molecules';
import { useToasts } from '@/features/notifications/ToastContext';
import { formatBytes, stripExtension } from '@/lib/format';
import { MetadataForm } from './components/MetadataForm';
import { TrackedUploadsList } from './components/TrackedUploadsList';
import { useTrackedUploads } from './useTrackedUploads';
import { useUploadDocuments } from './useUploadDocuments';
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES_PER_UPLOAD,
  hasErrors,
  normalizeMetadata,
  validateFile,
  validateMetadata,
  type MetadataErrors,
} from './validation';

interface PendingFile {
  key: string;
  file: File;
  fileError: string | null;
  metadata: DocumentMetadataInput;
}

let nextKey = 0;

/** Toast copy for a 202: distinguishes new documents from uploads that already existed. */
export function summarizeAccepted(items: UploadAcceptedItem[]): { title: string; description: string } {
  const duplicates = items.filter((item) => item.duplicateOf).length;
  const accepted = items.length - duplicates;
  const existed = duplicates === 1 ? '1 archivo ya existía' : `${duplicates} archivos ya existían`;
  if (accepted === 0) {
    return {
      title: existed,
      description: 'No se creó ninguna versión nueva; puedes abrir los documentos existentes desde la lista.',
    };
  }
  return {
    title: `${accepted} ${accepted === 1 ? 'documento aceptado' : 'documentos aceptados'}`,
    description: `La indexación continúa en segundo plano.${duplicates > 0 ? ` ${existed}.` : ''}`,
  };
}

function createPending(file: File, defaults: Partial<DocumentMetadataInput>): PendingFile {
  return {
    key: `${Date.now()}-${nextKey++}`,
    file,
    fileError: validateFile(file),
    metadata: {
      title: stripExtension(file.name),
      author: defaults.author ?? '',
      category: defaults.category ?? '',
      tags: [],
      version: defaults.version ?? '1.0.0',
    },
  };
}

export function UploadPage() {
  const [pending, setPending] = useState<PendingFile[]>([]);
  /** Files from the last selection that did not fit in the batch. */
  const [omitted, setOmitted] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const { push } = useToasts();
  const tracked = useTrackedUploads();
  const upload = useUploadDocuments({
    onAccepted: (response, input) => {
      tracked.track(response.items, input.metadata);
      setPending([]);
      setOmitted(0);
      setShowErrors(false);
      push({ tone: 'info', ...summarizeAccepted(response.items) });
    },
  });

  const addFiles = useCallback(
    (files: File[]) => {
      const last = pending[pending.length - 1]?.metadata;
      const room = Math.max(0, MAX_FILES_PER_UPLOAD - pending.length);
      const defaults = { author: last?.author, category: last?.category, version: last?.version };
      setOmitted(Math.max(0, files.length - room));
      setPending([...pending, ...files.slice(0, room).map((file) => createPending(file, defaults))]);
    },
    [pending],
  );

  const errorsByKey = useMemo(() => {
    const map = new Map<string, MetadataErrors>();
    for (const item of pending) map.set(item.key, validateMetadata(item.metadata));
    return map;
  }, [pending]);

  const sendable = pending.filter((item) => item.fileError === null);
  const invalidFiles = pending.length - sendable.length;
  const metadataInvalid = sendable.some((item) => hasErrors(errorsByKey.get(item.key) ?? {}));
  const canSubmit = sendable.length > 0 && !metadataInvalid && !upload.isPending;

  const submit = () => {
    if (metadataInvalid) {
      setShowErrors(true);
      return;
    }
    if (sendable.length === 0) return;
    upload.mutate({
      files: sendable.map((item) => item.file),
      metadata: sendable.map((item) => normalizeMetadata(item.metadata)),
    });
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Cargar documentos</h1>
          <p className="text-ink-soft">
            Formatos {ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')} de hasta{' '}
            {formatBytes(MAX_FILE_SIZE_BYTES)} cada uno; máximo {MAX_FILES_PER_UPLOAD} archivos por envío.
          </p>
        </div>

        <FileDropzone
          onFiles={addFiles}
          accept={ACCEPT_ATTRIBUTE}
          disabled={upload.isPending || pending.length >= MAX_FILES_PER_UPLOAD}
          hint="Puedes seleccionar varios archivos a la vez."
        />

        {omitted > 0 && (
          <p role="status" className="text-[13px] text-busy">
            {omitted === 1
              ? `Se omitió 1 archivo: el máximo por lote es ${MAX_FILES_PER_UPLOAD}.`
              : `Se omitieron ${omitted} archivos: el máximo por lote es ${MAX_FILES_PER_UPLOAD}.`}
          </p>
        )}

        {pending.length > 0 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4"
            noValidate
          >
            {pending.map((item, index) => (
              <MetadataForm
                key={item.key}
                formId={`file-${index}`}
                fileName={item.file.name}
                sizeBytes={item.file.size}
                value={item.metadata}
                errors={showErrors ? (errorsByKey.get(item.key) ?? {}) : {}}
                fileError={item.fileError}
                disabled={upload.isPending}
                onChange={(metadata) =>
                  setPending((current) =>
                    current.map((entry) => (entry.key === item.key ? { ...entry, metadata } : entry)),
                  )
                }
                onRemove={() => setPending((current) => current.filter((entry) => entry.key !== item.key))}
              />
            ))}

            {upload.error != null && (
              <ErrorState
                title="No se pudo enviar la carga"
                message={describeError(upload.error)}
                onRetry={submit}
                retrying={upload.isPending}
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSubmit} loading={upload.isPending}>
                {sendable.length === 1 ? 'Enviar 1 archivo' : `Enviar ${sendable.length} archivos`}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPending([]);
                  setOmitted(0);
                }}
                disabled={upload.isPending}
              >
                Descartar todo
              </Button>
              {invalidFiles > 0 && (
                <p className="text-[13px] text-bad">
                  {invalidFiles === 1
                    ? '1 archivo no válido no se enviará.'
                    : `${invalidFiles} archivos no válidos no se enviarán.`}
                </p>
              )}
            </div>
          </form>
        )}
      </section>

      <TrackedUploadsList entries={tracked.entries} onRemove={tracked.untrack} onClear={tracked.clear} />
    </div>
  );
}
