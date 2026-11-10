/**
 * HttpErrorMapping — turn a classified HttpError (from HttpClient, J2a) into a
 * platform-agnostic, actionable error descriptor.
 *
 * J2b screen error states: screens on all three platforms should render
 * localized, actionable error states based on this mapping instead of inline
 * `if (!res.ok)` checks. The mapping is deterministic: code + status drive the
 * error type and whether retrying is meaningful.
 *
 * Screens MUST NOT show an infinite spinner for a non-retryable failure
 * (404, 401/403) — `retryable` is false for those, so callers must render a
 * static error state. Abort is never user-facing.
 */

import type { HttpErrorCode } from './HttpClient';

export type ScreenErrorType =
  | 'network'
  | 'timeout'
  | 'feed'
  | 'notFound'
  | 'rateLimited'
  | 'auth'
  | 'serverError'
  | 'generic'
  | 'abort';

export interface ScreenError {
  /** Actionable, localized error state key. */
  type: ScreenErrorType;
  /** Classified transport/code (network, timeout, http, parse, abort, unknown). */
  code: HttpErrorCode | 'unknown';
  /** Original HTTP status if available. */
  status?: number;
  /** True if retrying this request is likely to succeed (transient failure). */
  retryable: boolean;
}

/**
 * Error types that are transient — retrying is reasonable.
 */
const RETRYABLE_TYPES: ReadonlySet<ScreenErrorType> = new Set([
  'network',
  'timeout',
  'feed',
  'rateLimited',
  'serverError',
]);

export function mapHttpError(error: unknown): ScreenError {
  if (!error || typeof error !== 'object') {
    return { type: 'generic', code: 'unknown', retryable: false };
  }

  // HttpError has a `.code` property and `.name === 'HttpError'` (J2a classification).
  const anyErr = error as { code?: HttpErrorCode; status?: number; name?: string };
  if (anyErr.code !== undefined && anyErr.name === 'HttpError') {
    const { code, status } = anyErr;

    switch (code) {
      case 'network':
        return { type: 'network', code, status, retryable: true };
      case 'timeout':
        return { type: 'timeout', code, status, retryable: true };
      case 'parse':
        // Malformed feed / bad JSON — retrying the same bad feed is still
        // worth one shot before giving up.
        return { type: 'feed', code, status, retryable: true };
      case 'abort':
        return { type: 'abort', code, status, retryable: false };
      case 'http':
        return mapHttpStatus(status);
      default:
        return { type: 'generic', code: 'unknown', status, retryable: false };
    }
  }

  return { type: 'generic', code: 'unknown', retryable: false };
}

function mapHttpStatus(status: number | undefined): ScreenError {
  if (!status) {
    return { type: 'generic', code: 'http', retryable: false };
  }
  switch (status) {
    case 404:
      return { type: 'notFound', code: 'http', status, retryable: false };
    case 408:
      return { type: 'timeout', code: 'http', status, retryable: true };
    case 429:
      return { type: 'rateLimited', code: 'http', status, retryable: true };
    case 401:
    case 403:
      return { type: 'auth', code: 'http', status, retryable: false };
    default:
      if (status >= 500) {
        return { type: 'serverError', code: 'http', status, retryable: true };
      }
      // Unmapped 4xx — generic, not retryable.
      return { type: 'generic', code: 'http', status, retryable: false };
  }
}

/**
 * True if the error state should ever be shown to the user.
 * Abort is never user-facing.
 */
export function isUserFacingError(error: ScreenError): boolean {
  return error.type !== 'abort';
}

/**
 * True if retrying the original request is reasonable.
 * This is a defensive check: the type is authoritative, so a notFound or auth
 * error is never retryable even if the `retryable` flag was set.
 */
export function isRetryable(error: ScreenError): boolean {
  return RETRYABLE_TYPES.has(error.type);
}
