import type { ApiError } from '@techdocs/shared';

const DEFAULT_BASE_URL = '/api';

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

/** Resolves an API path (`/search`) to an absolute URL usable by `fetch` and `EventSource`. */
export function apiUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${apiBaseUrl()}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Error thrown by the API client. Carries the HTTP status and, when the
 * backend answered with the shared `ApiError` body, its parsed payload.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly body: ApiError | null;

  constructor(status: number, message: string, body: ApiError | null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
  }

  get details(): string[] {
    const details = this.body?.details;
    return Array.isArray(details) ? details.map(String) : [];
  }

  static is(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  query?: Record<string, string | number | undefined>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...init } = options;
  let response: Response;
  try {
    response = await fetch(apiUrl(path, query), {
      ...init,
      headers: { Accept: 'application/json', ...headers },
    });
  } catch (error) {
    throw new ApiClientError(0, networkErrorMessage(error), null);
  }

  if (!response.ok) {
    const body = await parseApiError(response);
    throw new ApiClientError(response.status, body?.message ?? response.statusText, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function parseApiError(response: Response): Promise<ApiError | null> {
  try {
    const payload = (await response.json()) as Partial<ApiError>;
    if (payload && typeof payload.message === 'string') {
      return {
        statusCode: payload.statusCode ?? response.status,
        error: payload.error ?? response.statusText,
        message: payload.message,
        details: payload.details,
        timestamp: payload.timestamp ?? new Date().toISOString(),
        path: payload.path ?? response.url,
      };
    }
  } catch {
    // Non-JSON error body: fall back to the status text.
  }
  return null;
}

function networkErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? `No se pudo conectar con el servidor (${error.message})`
    : 'No se pudo conectar con el servidor';
}

/** Human-readable message for any error raised while talking to the API. */
export function describeError(error: unknown): string {
  if (ApiClientError.is(error)) {
    const details = error.details;
    return details.length > 0 ? `${error.message}: ${details.join('; ')}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}
