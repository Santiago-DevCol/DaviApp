import { publicIndexingFailure } from './indexing-failure';

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as { cause?: unknown }).cause = cause;
  return error;
}

describe('publicIndexingFailure', () => {
  it('hides the SQL and content of a tsvector overflow', () => {
    const error = withCause(
      'Failed query: update "documents" set status = $1\nparams: INDEXED,,term0 term1',
      new Error('string is too long for tsvector (2779804 bytes, max 1048575 bytes)'),
    );

    const message = publicIndexingFailure(error);

    expect(message).toContain('demasiado texto');
    expect(message).not.toContain('update');
    expect(message).not.toContain('term0');
    expect(message).not.toContain('tsvector');
  });

  it('reports a dependency outage without internals', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });

    const message = publicIndexingFailure(error);

    expect(message).toContain('problema temporal');
    expect(message).not.toContain('ECONNREFUSED');
  });

  it('uses a generic message for unknown failures', () => {
    expect(publicIndexingFailure(new Error('boom'))).toBe(
      'No se pudo indexar el documento. Verifica que el archivo no esté dañado e intenta nuevamente.',
    );
  });
});
