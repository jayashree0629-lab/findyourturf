import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/config';

// What went wrong, in terms the screens can explain to a user.
export type ApiErrorKind =
  | 'network' // no internet / server unreachable
  | 'timeout' // server did not answer in time
  | 'server' // server answered with an error (5xx) or unreadable data
  | 'client'; // server rejected the request (4xx)

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }

  // Worth one automatic retry? Timeouts are not retried: the user can tap "Try again".
  get retryable() {
    return this.kind === 'network' || this.kind === 'server';
  }
}

// Read-only on purpose: Step 3 only needs to READ data, so only GET exists here.
// A write helper will be added later, deliberately, when booking is built.
export async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = (body && (body.message || body.error)) || `Request failed (${response.status})`;
      throw new ApiError(response.status >= 500 ? 'server' : 'client', String(message), response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('server', 'The server sent a response we could not read.', response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('timeout', 'The server took too long to respond.');
    throw new ApiError('network', 'Could not reach the server.');
  } finally {
    clearTimeout(timer);
  }
}
