/**
 * J2b — Screen error states across platforms (J2b-1: HTTP error mapping).
 *
 * Contract under test:
 * - mapHttpError() turns a classified HttpError (from HttpClient, J2a) into a
 *   platform-agnostic, actionable error descriptor that screens can render as
 *   a localized error state.
 * - Mapping is deterministic: code + status drive the error type and whether
 *   retrying is meaningful.
 * - Screens must never show an infinite spinner for a non-transient failure
 *   (404, 401/403) — those must be clearly non-retryable.
 * - Abort (deliberate cancellation) must never surface as a user-facing error.
 */

import { describe, it, expect } from 'vitest';
import { mapHttpError, isUserFacingError, isRetryable } from './HttpErrorMapping';
import { HttpError } from './HttpClient';

describe('J2b-1 HTTP error → error-screen mapping', () => {
  describe('transport / classification codes', () => {
    it('maps code network to an offline/network state, retryable', () => {
      const err = new HttpError('network', 'Failed to fetch');
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('network');
      expect(mapped.code).toBe('network');
      expect(mapped.retryable).toBe(true);
      expect(isRetryable(mapped)).toBe(true);
      expect(isUserFacingError(mapped)).toBe(true);
    });

    it('maps code timeout to a timeout state, retryable', () => {
      const err = new HttpError('timeout', 'Request timed out');
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('timeout');
      expect(mapped.code).toBe('timeout');
      expect(mapped.retryable).toBe(true);
    });

    it('maps code parse to a malformed-feed state, retryable', () => {
      const err = new HttpError('parse', 'Malformed JSON response');
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('feed');
      expect(mapped.code).toBe('parse');
      expect(mapped.retryable).toBe(true);
    });

    it('maps code abort to an internal abort state, not user-facing, not retryable', () => {
      const err = new HttpError('abort', 'Request aborted');
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('abort');
      expect(mapped.code).toBe('abort');
      expect(mapped.retryable).toBe(false);
      // A deliberate cancellation is never shown to the user as an error.
      expect(isUserFacingError(mapped)).toBe(false);
      expect(isRetryable(mapped)).toBe(false);
    });
  });

  describe('HTTP status mapping', () => {
    it('maps 404 to not-found, not retryable', () => {
      const err = new HttpError('http', 'HTTP 404: Not Found', 404);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('notFound');
      expect(mapped.status).toBe(404);
      expect(mapped.retryable).toBe(false);
      expect(isUserFacingError(mapped)).toBe(true);
    });

    it('maps 429 to rate-limited, retryable', () => {
      const err = new HttpError('http', 'HTTP 429: Too Many Requests', 429);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('rateLimited');
      expect(mapped.status).toBe(429);
      expect(mapped.retryable).toBe(true);
    });

    it('maps 408 to a timeout state, retryable', () => {
      const err = new HttpError('http', 'HTTP 408: Request Timeout', 408);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('timeout');
      expect(mapped.status).toBe(408);
      expect(mapped.retryable).toBe(true);
    });

    it('maps 401 to an auth state, not retryable', () => {
      const err = new HttpError('http', 'HTTP 401: Unauthorized', 401);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('auth');
      expect(mapped.status).toBe(401);
      expect(mapped.retryable).toBe(false);
    });

    it('maps 403 to an auth state, not retryable', () => {
      const err = new HttpError('http', 'HTTP 403: Forbidden', 403);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('auth');
      expect(mapped.status).toBe(403);
      expect(mapped.retryable).toBe(false);
    });

    it('maps 500 to a server-error state, retryable', () => {
      const err = new HttpError('http', 'HTTP 500: Internal Server Error', 500);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('serverError');
      expect(mapped.status).toBe(500);
      expect(mapped.retryable).toBe(true);
    });

    it('maps 503 to a server-error state, retryable', () => {
      const err = new HttpError('http', 'HTTP 503: Service Unavailable', 503);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('serverError');
      expect(mapped.status).toBe(503);
      expect(mapped.retryable).toBe(true);
    });

    it('maps an unmapped 4xx (418) to a generic state, not retryable', () => {
      const err = new HttpError('http', 'HTTP 418: I am a teapot', 418);
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('generic');
      expect(mapped.status).toBe(418);
      expect(mapped.retryable).toBe(false);
    });

    it('treats a http error with no status as generic, not retryable', () => {
      const err = new HttpError('http', 'HTTP error without status');
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('generic');
      expect(mapped.status).toBeUndefined();
      expect(mapped.retryable).toBe(false);
    });
  });

  describe('robustness', () => {
    it('maps an unknown non-HttpError to generic, not retryable', () => {
      const mapped = mapHttpError(new Error('mystery failure'));

      expect(mapped.type).toBe('generic');
      expect(mapped.code).toBe('unknown');
      expect(mapped.retryable).toBe(false);
      expect(isUserFacingError(mapped)).toBe(true);
    });

    it('maps a string rejection to generic, not retryable', () => {
      const mapped = mapHttpError('something went wrong');

      expect(mapped.type).toBe('generic');
      expect(mapped.code).toBe('unknown');
      expect(mapped.retryable).toBe(false);
    });

    it('maps null to generic, not retryable', () => {
      const mapped = mapHttpError(null);

      expect(mapped.type).toBe('generic');
      expect(mapped.code).toBe('unknown');
      expect(mapped.retryable).toBe(false);
    });

    it('maps an HttpError with an unrecognized code to generic, not retryable', () => {
      const err = Object.assign(new Error('weird'), { name: 'HttpError', code: 'mystery' });
      const mapped = mapHttpError(err);

      expect(mapped.type).toBe('generic');
      expect(mapped.code).toBe('unknown');
      expect(mapped.retryable).toBe(false);
    });

    it('maps undefined to generic, not retryable', () => {
      const mapped = mapHttpError(undefined);

      expect(mapped.type).toBe('generic');
      expect(mapped.code).toBe('unknown');
      expect(mapped.retryable).toBe(false);
    });

    it('never treats a non-retryable type as retryable even if a flag is set', () => {
      // Defensive: notFound must never be retryable regardless of how it was
      // constructed, since retrying a 404 is pointless.
      const mapped: ReturnType<typeof mapHttpError> = {
        type: 'notFound',
        code: 'http',
        status: 404,
        retryable: true,
      };
      expect(isRetryable(mapped)).toBe(false);
    });
  });
});
