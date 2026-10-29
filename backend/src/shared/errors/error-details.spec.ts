import {
  describeError,
  errorStackFrames,
  isDependencyUnavailable,
  redactQueryParams,
} from './error-details';

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as { cause?: unknown }).cause = cause;
  return error;
}

describe('error-details', () => {
  it('redacts everything after Drizzle query parameters', () => {
    expect(redactQueryParams('Failed query: update x\nparams: INDEXED,,secret')).toBe(
      'Failed query: update x\nparams: [redacted]',
    );
  });

  it('walks the cause chain', () => {
    const error = withCause(
      'Failed query: update "documents" set status = $1',
      new Error('string is too long for tsvector'),
    );

    expect(describeError(error)).toContain('Failed query');
    expect(describeError(error)).toContain('tsvector');
  });

  it('detects dependency errors by code in the cause chain', () => {
    const cause = Object.assign(new Error('terminating connection'), { code: '57P01' });
    const error = withCause('Failed query', cause);

    expect(isDependencyUnavailable(error)).toBe(true);
  });

  it('does not classify an unrelated error as a dependency outage', () => {
    expect(isDependencyUnavailable(new Error('connection refused to 10.0.0.1'))).toBe(false);
  });

  it('redacts params at every level of the chain', () => {
    const cause = new Error('inner\nparams: secret');
    const error = withCause('outer\nparams: secret', cause);

    const detail = describeError(error);

    expect(detail).not.toContain('secret');
    expect(detail.match(/\[redacted\]/g)).toHaveLength(2);
  });

  it('does not loop forever on a circular cause', () => {
    const error = new Error('outer');
    (error as { cause?: unknown }).cause = error;

    expect(describeError(error)).toContain('[circular cause]');
  });

  it('returns only stack frames, so the message is not repeated', () => {
    const error = new Error('secret\nparams: hidden');

    const frames = errorStackFrames(error);

    expect(frames).toContain(' at ');
    expect(frames).not.toContain('secret');
    expect(frames).not.toContain('hidden');
  });

  it('does not treat message lines that look like frames as stack frames', () => {
    const error = new Error(
      'Failed query: update x\nparams: INDEXED,,\n    at the end of the day the params leak',
    );

    const frames = errorStackFrames(error);

    expect(frames).toContain(' at ');
    expect(frames).not.toContain('params leak');
    expect(frames).not.toContain('end of the day');
  });
});
