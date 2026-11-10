/**
 * J1 — Telemetry Redaction Contract Tests
 *
 * Proves analytics and crash reporting exclude:
 * - Stream URLs with tokens
 * - Device identifiers (UUIDs in text context)
 * - Credentials (Bearer tokens, API keys)
 *
 * These are the contract tests for J1. The implementation lives in
 * core/src/analytics/Redact.ts and is wired into:
 * - Analytics.trackError() and Analytics.trackInteraction()
 * - CrashReporter.captureError()
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Analytics } from './Analytics';
import { redactSensitive, redactURLParams } from './Redact';
import {
  captureError,
  type CrashReport,
  type CrashReporterStore,
} from '../crash-reporting/CrashReporter';

// ── Test Fixtures ──────────────────────────────────────────────
// Use clearly fake, low-entropy test values that still match the redaction
// regexes. These must NOT look like real credentials (gitleaks allowlist).

const STREAM_URL_TOKEN = 'https://cdn.example.com/live/stream.m3u8?token=abc123secret&channel=456';
const STREAM_URL_APIKEY = 'https://cdn.example.com/vod/content.m3u8?apikey=***';
const STREAM_URL_SIGNED =
  'https://cdn.example.com/live/stream.m3u8?signature=deadbeefcafe1234&expires=999999';

// Bearer token (JWT-like)
const BEARER_ERROR =
  'Auth failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature rejected';

// API key (Stripe-like format — use sk_test_ prefix with allowlisted dummy)
const API_KEY_ERROR = 'Request rejected: API key pk_test_bbbbbbbbbbbbbbbb is not valid';

// Device UUID embedded in error text
const DEVICE_UUID_ERROR = 'Session error: device=a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Email
const EMAIL_ERROR = 'user@example.com';

// ── Helpers ────────────────────────────────────────────────────

function makeAnalytics(): Analytics {
  const a = new Analytics();
  a.setOptOut(false);
  return a;
}

// ── Tests ──────────────────────────────────────────────────────

describe('J1 - redactURLParams', () => {
  it('redacts token query param', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?token=abc123&other=value');
    expect(result).not.toContain('abc123');
    expect(result).toContain('token=REDACTED');
    expect(result).toContain('other=value');
  });

  it('redacts key query param', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?key=xyz789&format=hls');
    expect(result).not.toContain('xyz789');
    expect(result).toContain('key=REDACTED');
  });

  it('redacts apikey query param', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?apikey=***');
    expect(result).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
    expect(result).toContain('apikey=REDACTED');
  });

  it('redacts signature query param', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?signature=deadbeef1234');
    expect(result).not.toContain('deadbeef1234');
    expect(result).toContain('signature=REDACTED');
  });

  it('preserves non-sensitive query params', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?format=hls&quality=720p');
    expect(result).toContain('format=hls');
    expect(result).toContain('quality=720p');
  });

  it('preserves the URL path', () => {
    const result = redactURLParams('https://cdn.example.com/stream.m3u8?token=abc123');
    expect(result).toContain('cdn.example.com/stream.m3u8');
  });

  it('handles non-URL strings gracefully', () => {
    const result = redactURLParams('not a url at all');
    expect(result).toBe('not a url at all');
  });

  it('redacts multiple sensitive params', () => {
    const result = redactURLParams(
      'https://cdn.example.com/stream.m3u8?token=abc123&apikey=***&signature=cafebabe'
    );
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
    expect(result).not.toContain('cafebabe');
    expect(result).toContain('token=REDACTED');
    expect(result).toContain('apikey=REDACTED');
    expect(result).toContain('signature=REDACTED');
  });
});

describe('J1 - redactSensitive', () => {
  it('redacts stream URLs with tokens in error messages', () => {
    const result = redactSensitive(`Feed fetch failed: ${STREAM_URL_TOKEN}`);
    expect(result).not.toContain('abc123secret');
    expect(result).not.toContain('xyz789');
  });

  it('redacts stream URLs with API keys', () => {
    const result = redactSensitive(`Request to: ${STREAM_URL_APIKEY}`);
    expect(result).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
    expect(result).toContain('REDACTED');
  });

  it('redacts stream URLs with signatures', () => {
    const result = redactSensitive(`URL: ${STREAM_URL_SIGNED}`);
    expect(result).not.toContain('deadbeefcafe1234');
    expect(result).toContain('REDACTED');
  });

  it('redacts Bearer tokens', () => {
    const result = redactSensitive(`Auth error: ${BEARER_ERROR}`);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result).toContain('Bearer REDACTED');
  });

  it('redacts API keys (sk_live_ format)', () => {
    const result = redactSensitive(`Error: ${API_KEY_ERROR}`);
    expect(result).not.toContain('pk_test_bbbbbbbbbbbbbbbb');
    expect(result).toContain('REDACTED_API_KEY');
  });

  it('redacts UUIDs in error context (device IDs)', () => {
    const result = redactSensitive(`Session error: ${DEVICE_UUID_ERROR}`);
    expect(result).not.toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result).toContain('REDACTED_UUID');
  });

  it('redacts email addresses', () => {
    const result = redactSensitive(`User: ${EMAIL_ERROR}`);
    expect(result).not.toContain('user@example.com');
    expect(result).toContain('REDACTED_EMAIL');
  });

  it('preserves safe text', () => {
    const result = redactSensitive('Button click on HomeScreen');
    expect(result).toBe('Button click on HomeScreen');
  });

  it('handles empty string', () => {
    expect(redactSensitive('')).toBe('');
  });

  it('redacts multiple sensitive items in one string', () => {
    const input = `Auth: Bearer eyJhbGciOiJIUzI1NiJ9.x.y, URL: https://cdn.example.com/live.m3u8?token=secret123`;
    const result = redactSensitive(input);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(result).not.toContain('secret123');
    expect(result).toContain('Bearer REDACTED');
  });
});

describe('J1 - Analytics.trackError redaction', () => {
  let analytics: Analytics;

  beforeEach(() => {
    analytics = makeAnalytics();
    analytics.reset();
  });

  it('redacts stream URLs in errorMessage', () => {
    analytics.trackError('network', `Feed fetch failed: ${STREAM_URL_TOKEN}`, 'feed_fetch');

    const events = analytics.getPendingEvents();
    const errorEvent = events.find((e) => e.eventType === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.errorMessage).not.toContain('abc123secret');
    expect(errorEvent?.errorMessage).not.toContain('xyz789');
    expect(errorEvent?.errorMessage).toContain('REDACTED');
  });

  it('redacts Bearer tokens in errorMessage', () => {
    analytics.trackError('unknown', BEARER_ERROR, 'api_call');

    const events = analytics.getPendingEvents();
    const errorEvent = events.find((e) => e.eventType === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.errorMessage).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('redacts sensitive data in context string', () => {
    analytics.trackError(
      'network',
      'Playback error',
      `url=${STREAM_URL_TOKEN}, device=a1b2c3d4-e5f6-7890-abcd-ef1234567890`
    );

    const events = analytics.getPendingEvents();
    const errorEvent = events.find((e) => e.eventType === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.context).not.toContain('abc123secret');
    expect(errorEvent?.context).not.toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });
});

describe('J1 - Analytics.trackInteraction redaction', () => {
  let analytics: Analytics;

  beforeEach(() => {
    analytics = makeAnalytics();
    analytics.reset();
  });

  it('redacts sensitive data in details', () => {
    analytics.trackInteraction('fetch_stream', 'vod', `url=${STREAM_URL_APIKEY}, status=403`);

    const events = analytics.getPendingEvents();
    const interactionEvent = events.find((e) => e.eventType === 'interaction');
    expect(interactionEvent).toBeDefined();
    expect(interactionEvent?.details).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
  });

  it('preserves non-sensitive details', () => {
    analytics.trackInteraction('play_video', 'Breaking Bad S01E01', 'duration=4725');

    const events = analytics.getPendingEvents();
    const interactionEvent = events.find((e) => e.eventType === 'interaction');
    expect(interactionEvent).toBeDefined();
    expect(interactionEvent?.details).toContain('duration=4725');
  });
});

describe('J1 - CrashReporter.captureError redaction', () => {
  it('redacts stream URLs in errorMessage', () => {
    const report: CrashReport = captureError(new Error(`Feed fetch failed: ${STREAM_URL_TOKEN}`));
    expect(report.errorMessage).not.toContain('abc123secret');
    expect(report.errorMessage).not.toContain('xyz789');
    expect(report.errorMessage).toContain('REDACTED');
  });

  it('redacts stream URLs in stackTrace', () => {
    const error = new Error('Network request failed');
    error.stack = `Error: Network request failed\n    at fetchFeed (https://cdn.example.com/live/stream.m3u8?token=abc123secret)`;
    const report: CrashReport = captureError(error);
    expect(report.stackTrace).not.toContain('abc123secret');
  });

  it('redacts Bearer tokens in errorMessage', () => {
    const report: CrashReport = captureError(new Error(BEARER_ERROR));
    expect(report.errorMessage).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('redacts email addresses in errorMessage', () => {
    const report: CrashReport = captureError(new Error(`Request from ${EMAIL_ERROR}`));
    expect(report.errorMessage).not.toContain('user@example.com');
  });

  it('does not leak URL tokens in crash reports', () => {
    const err = new Error('Stream failed: https://cdn.example.com/stream.m3u8?apikey=***');
    const report: CrashReport = captureError(err);
    expect(report.errorMessage).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
    expect(report.errorMessage).toContain('REDACTED');
    expect(report.stackTrace).not.toContain('sk_live_aaaaaaaaaaaaaaaa');
  });
});
