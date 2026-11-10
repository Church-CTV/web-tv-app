/**
 * HttpClient — retry with bounded exponential backoff + jitter, timeout,
 * error classification, and external abort/cancellation support.
 *
 * Retry policy (J2 network failure matrix):
 * - Transient failures are retried: network errors, timeouts, HTTP 408,
 *   HTTP 429, HTTP 5xx, and malformed JSON responses.
 * - Non-transient failures fail fast: other HTTP 4xx, external abort.
 * - Backoff: full jitter, capped — delay = random() * min(maxDelayMs, base * 2^n).
 */

export interface HttpClientConfig {
  /** Default timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum total attempts (1 = single attempt, no retry) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms */
  retryBaseDelayMs?: number;
  /** Cap for each individual backoff delay in ms */
  maxDelayMs?: number;
  /** Jitter source; injectable for deterministic tests */
  random?: () => number;
  /** External abort signal — cancels in-flight requests and pending backoffs */
  signal?: AbortSignal;
  /** Additional request headers (merged with Content-Type for JSON bodies) */
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

export type HttpErrorCode = 'network' | 'timeout' | 'http' | 'parse' | 'abort';

/**
 * Classified HTTP/transport error.
 * `code` lets UI layers render actionable, localized states:
 * - 'network' → offline / connection failure screen
 * - 'timeout' → server slow / timeout screen
 * - 'http'    → status-specific screens (404, 401/403, 429, 5xx)
 * - 'parse'   → malformed feed / data error screen
 * - 'abort'   → request cancelled (no user-facing error)
 */
export class HttpError extends Error {
  readonly code: HttpErrorCode;
  readonly status?: number;

  constructor(code: HttpErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = status;
  }
}

function isTransientHttp(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Classify transport-level fetch failures into classified HttpErrors.
 *
 * - External abort (deliberate cancellation) → 'abort'
 * - Internal timeout abort → 'timeout'
 * - Offline / DNS / connection-reset rejections → 'network'
 * - Anything else → 'network' fallback with the original message
 */
function classify(err: unknown, externalAborted: boolean): Error {
  if (externalAborted) {
    return new HttpError('abort', 'Request aborted');
  }
  if (isAbortError(err)) {
    return new HttpError('timeout', 'Request timed out');
  }
  if (err instanceof Error && (err.name === 'TypeError' || err.name === 'NetworkError')) {
    return new HttpError('network', err.message || 'Network error');
  }
  const message = err instanceof Error ? err.message : String(err);
  return new HttpError('network', message || 'Request failed');
}

/**
 * Make a GET request with retry and timeout
 */
export async function get(
  url: string,
  config?: HttpClientConfig
): Promise<{ status: number; data: unknown }> {
  return request(url, { method: 'GET', ...config });
}

/**
 * Make a POST request with retry and timeout
 */
export async function post(
  url: string,
  body: unknown,
  config?: HttpClientConfig
): Promise<{ status: number; data: unknown }> {
  return request(url, { method: 'POST', body: JSON.stringify(body), ...config });
}

interface RequestOptions extends HttpClientConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
}

/**
 * Core request implementation with retry and timeout
 */
async function request(
  url: string,
  options: RequestOptions
): Promise<{ status: number; data: unknown }> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseDelayMs = DEFAULT_RETRY_DELAY,
    maxDelayMs = DEFAULT_MAX_DELAY,
    random = Math.random,
    signal,
    ...fetchOptions
  } = options;

  const abortError = () => new HttpError('abort', 'Request aborted');

  // Externally aborted before any attempt: fail fast without a network call.
  if (signal?.aborted) throw abortError();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Externally aborted (e.g. during a backoff wait): stop immediately.
    if (signal?.aborted) throw abortError();

    if (attempt > 0) {
      // Bounded exponential backoff with full jitter.
      const cap = Math.min(maxDelayMs, retryBaseDelayMs * 2 ** (attempt - 1));
      const delay = Math.max(0, Math.floor(random() * cap));
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      });
      if (signal?.aborted) throw abortError();
    }

    try {
      // Internal timeout controller; the external signal aborts it too.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      if (signal && !signal.aborted) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const fetchOpts: RequestInit = {
        signal: controller.signal,
        ...fetchOptions,
      };
      if (fetchOptions.body) {
        if (!fetchOpts.headers) {
          fetchOpts.headers = { 'Content-Type': 'application/json' };
        } else if (typeof fetchOpts.headers === 'object') {
          const headers = fetchOpts.headers as Record<string, string>;
          if (!Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
            headers['Content-Type'] = 'application/json';
          }
        }
      }

      let response: Response;
      try {
        response = await fetch(url, fetchOpts);
      } catch (err) {
        clearTimeout(timeoutId);
        throw classify(err, signal?.aborted ?? false);
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpError(
          'http',
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new HttpError('parse', 'Malformed JSON response');
      }
      return { status: response.status, data };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Abort is never retried — it is a deliberate cancellation.
      if (lastError instanceof HttpError && lastError.code === 'abort') {
        throw lastError;
      }
      // Non-transient failures (e.g. 4xx other than 408/429) fail fast.
      if (
        lastError instanceof HttpError &&
        lastError.code === 'http' &&
        !isTransientHttp(lastError.status ?? 0)
      ) {
        throw lastError;
      }
      // Transient failures continue the loop; after the final attempt the
      // last error is thrown below.
    }
  }

  // Loop ended: either every attempt failed (lastError set) or no attempt was
  // made (maxRetries = 0).
  if (lastError) throw lastError;
  throw new HttpError('network', 'Request failed');
}
