import { describeError, isDependencyUnavailable } from '../../shared/errors/error-details';

const TSVECTOR_OVERFLOW = /too long for tsvector/i;
const PUBLIC_FAILURES = {
  tooLarge:
    'El documento tiene demasiado texto para el índice de búsqueda. Reduce el tamaño o divídelo en partes.',
  unavailable:
    'No se pudo indexar por un problema temporal del servicio. Vuelve a intentarlo en unos minutos.',
  generic:
    'No se pudo indexar el documento. Verifica que el archivo no esté dañado e intenta nuevamente.',
} as const;

/**
 * Maps any indexing failure to a user-facing reason that never carries the
 * query, its parameters, file paths or parser output. The internal detail is
 * for the logs (`describeError`), not for the document record.
 */
export function publicIndexingFailure(error: unknown): string {
  if (TSVECTOR_OVERFLOW.test(describeError(error))) {
    return PUBLIC_FAILURES.tooLarge;
  }
  if (isDependencyUnavailable(error)) {
    return PUBLIC_FAILURES.unavailable;
  }
  return PUBLIC_FAILURES.generic;
}
