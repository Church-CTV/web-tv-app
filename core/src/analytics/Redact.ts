/**
 * Redact — sensitive data redaction for analytics and crash reporting.
 *
 * Ensures analytics events, crash reports, and diagnostics do not leak:
 * - Stream URLs with tokens or API keys
 * - Bearer JWT tokens
 * - API keys (sk_live_*, sk_test_*)
 * - Device UUIDs
 * - Email addresses
 *
 * Call redactSensitive() on all user-facing strings before
 * storing or sending them in telemetry.
 */

const SENSITIVE_URL_PARAMS = new Set([
  'token',
  'key',
  'apikey',
  'api_key',
  'signature',
  'sig',
  'auth',
  'credential',
  'secret',
  'sessionid',
  'session_id',
  'refresh_token',
  'access_token',
]);

/**
 * Redact sensitive URL query parameters.
 * Replaces values of known sensitive params with 'REDACTED'.
 * Preserves the URL host, path, and non-sensitive params.
 */
export function redactURLParams(url: string): string {
  const questionIndex = url.indexOf('?');
  if (questionIndex === -1) return url;

  const base = url.slice(0, questionIndex);
  const queryString = url.slice(questionIndex + 1);

  const redactedParts = queryString.split('&').map((part) => {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) return part;

    const paramKey = part.slice(0, eqIndex).toLowerCase();
    if (SENSITIVE_URL_PARAMS.has(paramKey)) {
      return `${part.slice(0, eqIndex)}=REDACTED`;
    }

    return part;
  });

  return `${base}?${redactedParts.join('&')}`;
}

/**
 * Redact multiple classes of sensitive data from a string.
 *
 * Applied in order:
 * 1. Stream URLs — redact sensitive query params
 * 2. Bearer tokens — `Bearer <JWT>` → `Bearer REDACTED`
 * 3. API keys — `sk_live_*`, `sk_test_*`, `pk_live_*`
 * 4. UUIDs — full 36-char UUID patterns
 * 5. Email addresses — user@example.com
 */
export function redactSensitive(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  if (input === '') return '';

  let result = input;

  // 1. Redact URLs (match common URL patterns)
  result = result.replace(/\b(https?:\/\/[^\s,;(){}<>]+)([?&][^\s,;(){}<>]*)?/gi, (match) =>
    redactURLParams(match)
  );

  // 2. Redact Bearer JWT tokens
  result = result.replace(
    /\bBearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi,
    'Bearer REDACTED'
  );

  // 3. Redact API keys (Stripe-style and common patterns)
  result = result.replace(/\b(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{16,}\b/g, 'REDACTED_API_KEY');

  // 4. Redact UUIDs (only full 36-char format to avoid false positives)
  result = result.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    'REDACTED_UUID'
  );

  // 5. Redact email addresses
  result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'REDACTED_EMAIL');

  return result;
}
