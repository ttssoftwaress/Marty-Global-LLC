import type { ApiErrorBody, ApiErrorCode } from '@/types/api';

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/*
 * A response whose body IS a file rather than the `{ data }` envelope — the
 * reports export, and anything the backend generates on the fly.
 *
 * It goes through the same origin, credentials, and error handling as every
 * other call, which is why it lives here instead of a raw `fetch` at the call
 * site: a failure still answers with the envelope, so the caller gets the same
 * `ApiError` and the same code-to-copy rules as the rest of the app.
 */
export async function apiDownload(
  path: string,
): Promise<{ blob: Blob; filename: string | null }> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  } catch {
    throw new ApiError(
      0,
      'INTERNAL_ERROR',
      'Could not reach the server. Is the API running?',
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed',
      error?.details ?? {},
    );
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('Content-Disposition'),
    ),
  };
}

// The name the backend chose, off `Content-Disposition`. Null when the header is
// absent or unreadable — the caller supplies its own fallback rather than
// guessing here.
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

// Hands a generated file to the browser. The object URL is revoked once the
// click has been dispatched, or the blob stays in memory for the tab's life.
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'INTERNAL_ERROR',
      'Could not reach the server. Is the API running?',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed',
      error?.details ?? {},
    );
  }

  return body as T;
}
