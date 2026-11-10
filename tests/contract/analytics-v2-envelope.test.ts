/** Synthetic fixtures exercise client behavior without live-server access. */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_LEGACY_PATH,
  analyticsEnvelopeErrors,
  buildV2ExportEnvelope,
  resolveAnalyticsEndpoint,
  resolveClientConfig,
  type AnalyticsEnvelope,
  type AnalyticsEvent,
  type ClientConfig,
} from '@ctv/core';

const FIXTURES = path.resolve(__dirname, '..', '..', 'shared', 'test-fixtures', 'synthetic');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf-8'));

// The synthetic documents, not their inner config: a delivered profile is
// validated as a whole document (apiVersion + configVersion + config), and this
// suite must exercise exactly that path.
const firstProfile = read('one.config.json');
const secondProfile = read('two.config.json');

const FIRST_BASE = 'https://channel.example.test';

function withAnalytics(document: Record<string, unknown>, patch: Record<string, unknown>) {
  const clone = structuredClone(document) as { config: { analytics: Record<string, unknown> } };
  Object.assign(clone.config.analytics, patch);
  return clone;
}

function events(): AnalyticsEvent[] {
  return [
    {
      eventType: 'screen_view',
      timestamp: '2026-11-09T20:00:00.000Z',
      screenName: 'home',
      previousScreen: 'splash',
      appVersion: '0.1.0',
      sessionDuration: 12,
    },
    {
      eventType: 'content_play',
      timestamp: '2026-11-09T20:00:05.000Z',
      contentId: 'video-1',
      contentTitle: 'A title',
      contentDuration: 1200,
      sourceScreen: 'home',
    },
    {
      eventType: 'interaction',
      timestamp: '2026-11-09T20:00:06.000Z',
      action: 'play',
      target: 'content-detail',
      details: 'redacted',
    },
  ];
}

describe('analytics endpoint resolution from the delivered profile', () => {
  it('uses the absolute url the first synthetic profile names, in v2 envelope mode', () => {
    const effective = resolveClientConfig({ remote: firstProfile }).config;
    expect(resolveAnalyticsEndpoint(effective, FIRST_BASE)).toEqual({
      url: 'https://channel.example.test/api/v2/analytics',
      envelope: 'v2',
    });
  });

  it('uses the absolute url the second synthetic profile names, in v2 envelope mode', () => {
    const effective = resolveClientConfig({ remote: secondProfile }).config;
    expect(resolveAnalyticsEndpoint(effective, 'https://second.example.test')).toEqual({
      url: 'https://second.example.test/api/v2/analytics',
      envelope: 'v2',
    });
  });

  it('keeps the legacy same-origin route for a server that delivers no profile', () => {
    const effective = resolveClientConfig({ bundled: null, remote: null }).config;
    expect(effective.analytics.exportUrl).toBe('');
    expect(resolveAnalyticsEndpoint(effective, FIRST_BASE)).toEqual({
      url: FIRST_BASE + ANALYTICS_LEGACY_PATH,
      envelope: 'legacy',
    });
  });

  it('normalises the launch base when it joins the legacy route', () => {
    // Slash handling used to live in each adapter; it now lives with the origin
    // policy, and a base carrying a path prefix must survive the join.
    const effective = resolveClientConfig({ bundled: null, remote: null }).config;
    expect(resolveAnalyticsEndpoint(effective, 'https://host.example/').url).toBe(
      'https://host.example' + ANALYTICS_LEGACY_PATH
    );
    expect(resolveAnalyticsEndpoint(effective, 'https://host.example/ctv///').url).toBe(
      'https://host.example/ctv' + ANALYTICS_LEGACY_PATH
    );
  });

  it('refuses an export url on another origin and keeps telemetry same-origin', () => {
    const effective = resolveClientConfig({
      remote: withAnalytics(firstProfile, {
        exportUrl: 'https://collector.example.net/api/v2/analytics',
      }),
    }).config;
    const resolved = resolveAnalyticsEndpoint(effective, FIRST_BASE);
    expect(resolved.envelope).toBe('legacy');
    expect(resolved.url).toBe(FIRST_BASE + ANALYTICS_LEGACY_PATH);
    expect(resolved.errors ?? []).toContain('origin-not-allowed:analytics.exportUrl');
  });

  it('refuses the whole profile when the export url is relative (the C103 Second shape)', () => {
    // The live Second feed document once named analytics.exportUrl = /analytics,
    // a value this client cannot resolve to an origin. Partial application of a
    // half-valid endpoint is the failure CONFIGURATION.md forbids.
    const resolvedDoc = resolveClientConfig({
      remote: withAnalytics(firstProfile, { exportUrl: '/analytics' }),
      allowedBaseUrl: FIRST_BASE,
    });
    expect(resolvedDoc.source).toBe('code-defaults');
    expect(resolvedDoc.errors).toContain('invalid-url:analytics.exportUrl');
    expect(resolvedDoc.config.analytics.exportUrl).toBe('');
  });
});

describe('the v2 envelope the profile-named endpoint requires', () => {
  it('builds an object carrying deviceInfo.deviceId and the events array', () => {
    const body = buildV2ExportEnvelope(events(), {
      deviceId: 'device-42',
      channelName: 'Example Channel',
      appVersion: '0.1.0',
    });
    expect(Array.isArray(body)).toBe(false);
    expect(body.deviceInfo).toEqual({
      deviceId: 'device-42',
      channelName: 'Example Channel',
      appVersion: '0.1.0',
    });
    expect(body.events).toHaveLength(3);
    expect(analyticsEnvelopeErrors(body)).toEqual([]);
  });

  it('emits only fields the server allow-lists (synthetic allow-list)', () => {
    const allowed = new Set(['eventType', 'timestamp', 'contentId', 'contentTitle', 'contentDuration', 'screenName', 'previousScreen', 'appVersion', 'sessionDuration', 'sourceScreen', 'action', 'target', 'details']);
    const body = buildV2ExportEnvelope(events(), { deviceId: 'device-42' });
    const emitted = new Set<string>();
    for (const event of body.events) for (const key of Object.keys(event)) emitted.add(key);
    expect(emitted.size).toBeGreaterThan(0);
    for (const key of emitted) expect(allowed.has(key)).toBe(true);
  });

  it('names an event field the server would refuse, instead of sending it', () => {
    const smuggled = events();
    (smuggled[0] as Record<string, unknown>).deviceId = 'device-42';
    const body = buildV2ExportEnvelope(smuggled, { deviceId: 'device-42' });
    expect(analyticsEnvelopeErrors(body)).toEqual(['unknown-event-field:deviceId']);
  });

  it('refuses an envelope with no deviceId - the exact reason a malformed envelope', () => {
    const noDeviceInfo = { events: events() } as unknown as AnalyticsEnvelope;
    expect(analyticsEnvelopeErrors(noDeviceInfo)).toContain('missing-deviceId');
    const emptyId = buildV2ExportEnvelope(events(), { deviceId: '' });
    expect(analyticsEnvelopeErrors(emptyId)).toContain('missing-deviceId');
  });

  it('refuses a bare event array - the body the adapters send today', () => {
    // A bare array is not a valid v2 envelope.
    expect(analyticsEnvelopeErrors(events() as unknown as AnalyticsEnvelope)).toEqual([
      'invalid-event-envelope',
    ]);
  });

  it('refuses a measurement field the server cannot store', () => {
    const withPlayback = events();
    (withPlayback[1] as Record<string, unknown>).watchSeconds = -5;
    expect(
      analyticsEnvelopeErrors(buildV2ExportEnvelope(withPlayback, { deviceId: 'device-42' }))
    ).toEqual(['invalid-event-measurement:watchSeconds']);
  });

  it('keeps the legacy body a plain array for a server that names no v2 endpoint', () => {
    // 'legacy' mode is the old contract: the body stays exactly what the legacy
    // /api/analytics route already accepts, byte for byte.
    const effective = resolveClientConfig({ bundled: null, remote: null }).config;
    const resolved = resolveAnalyticsEndpoint(effective, FIRST_BASE);
    expect(resolved.envelope).toBe('legacy');
    const legacyBody = events();
    expect(Array.isArray(legacyBody)).toBe(true);
    expect(JSON.parse(JSON.stringify(legacyBody))).toEqual(JSON.parse(JSON.stringify(events())));
  });
});
