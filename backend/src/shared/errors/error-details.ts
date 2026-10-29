const DEPENDENCY_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  '57P01',
  '57P02',
  '57P03',
]);

const DEPENDENCY_MESSAGE =
  /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|terminating connection|connection terminated|Connection terminated/i;

const MAX_CAUSE_DEPTH = 5;

export function describeError(error: unknown): string {
  return describe(error, new Set<unknown>(), 0);
}

export function isDependencyUnavailable(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; current !== undefined && depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);

    if (hasDependencyCode(current)) {
      return true;
    }
    if (current instanceof Error && DEPENDENCY_MESSAGE.test(current.message)) {
      return true;
    }
    current = causeOf(current);
  }

  return false;
}

export function redactQueryParams(message: string): string {
  return message.replace(/(\bparams:\s*)[\s\S]*$/i, '$1[redacted]');
}

export function errorStackFrames(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) {
    return undefined;
  }
  const frames = error.stack.split('\n').filter((line) => /^\s+at /.test(line));
  return frames.length > 0 ? frames.join('\n') : undefined;
}

function describe(error: unknown, seen: Set<unknown>, depth: number): string {
  if (depth > MAX_CAUSE_DEPTH) {
    return '[cause chain truncated]';
  }
  if (seen.has(error)) {
    return '[circular cause]';
  }
  seen.add(error);

  const message =
    error instanceof Error ? redactQueryParams(error.message) : redactQueryParams(String(error));
  const cause = causeOf(error);

  return cause === undefined ? message : `${message} | cause: ${describe(cause, seen, depth + 1)}`;
}

function causeOf(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('cause' in error)) {
    return undefined;
  }
  return (error as { cause?: unknown }).cause;
}

function hasDependencyCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && DEPENDENCY_CODES.has(code);
}
