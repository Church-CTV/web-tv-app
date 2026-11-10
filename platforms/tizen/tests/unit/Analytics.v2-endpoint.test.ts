/**
 * WEB-054 (Tizen transport): the analytics POST must land on the url the
 * delivered channel profile names, and its body must be the envelope that url
 * requires.
 *
 * The live answer for the body this adapter sent until now was
 * `400 {"error":"invalid-event-envelope"}` - see
 * shared/test-fixtures/synthetic/analytics-v2-probe.json. The url and the
 * mode both come from core's resolver, so this suite pins what the adapter is
 * responsible for: post to the url it is given, wrap only in the mode asked for,
 * and refuse to send a v2 body it cannot certify.
 */

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAnalyticsEndpoint, resolveClientConfig } from '@ctv/core';

import { createAnalyticsExport } from '../../src/Adapter/Analytics';

const FIRST_BASE = 'https://channel.example.test';
// The captured wire document (apiVersion + configVersion + config), which is
// the shape resolveClientConfig validates.
const PROFILE = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'shared',
      'test-fixtures',
      'synthetic',
      'one.config.json'
    ),
    'utf-8'
  )
);

interface Captured {
  method: string | null;
  url: string | null;
  body: string | null;
}

function stubXHR(capture: Captured, status = 200): void {
  class MockXHR {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    status = 0;
    timeout = 0;
    open(method: string, url: string): void {
      capture.method = method;
      capture.url = url;
    }
    setRequestHeader(): void {}
    send(body: string): void {
      capture.body = body;
      this.status = status;
      this.onload?.();
    }
    abort(): void {}
  }
  vi.stubGlobal('XMLHttpRequest', MockXHR);
}

const oneEvent = [
  {
    eventType: 'screen_view',
    timestamp: '2026-11-09T20:00:00.000Z',
    screenName: 'home',
    appVersion: '0.1.0',
  },
];

describe('Tizen analytics transport against the endpoint the profile names', () => {
  let capture: Captured;
  beforeEach(() => {
    capture = { method: null, url: null, body: null };
    stubXHR(capture);
  });

  it('posts the v2 envelope to the url the First profile names', async () => {
    const endpoint = resolveAnalyticsEndpoint(
      resolveClientConfig({ remote: PROFILE }).config,
      FIRST_BASE
    );
    const exportFn = createAnalyticsExport(endpoint);

    await exportFn(oneEvent, { deviceId: 'device-42', channelName: 'Example Channel' });

    expect(capture.method).toBe('POST');
    expect(capture.url).toBe('https://channel.example.test/api/v2/analytics');
    const sent = JSON.parse(capture.body ?? 'null') as Record<string, unknown>;
    expect(Array.isArray(sent)).toBe(false);
    expect(sent.deviceInfo).toMatchObject({ deviceId: 'device-42' });
    expect(sent.events).toHaveLength(1);
  });

  it('keeps the plain event array for a legacy server that names no v2 endpoint', async () => {
    const endpoint = resolveAnalyticsEndpoint(
      resolveClientConfig({ bundled: null, remote: null }).config,
      FIRST_BASE
    );
    const exportFn = createAnalyticsExport(endpoint);

    await exportFn(oneEvent);

    expect(capture.url).toBe('https://channel.example.test/api/analytics');
    expect(JSON.parse(capture.body ?? 'null')).toEqual(oneEvent);
  });

  it('sends nothing when a v2 body would be refused, and says why', async () => {
    const endpoint = resolveAnalyticsEndpoint(
      resolveClientConfig({ remote: PROFILE }).config,
      FIRST_BASE
    );
    const exportFn = createAnalyticsExport(endpoint);

    await expect(exportFn(oneEvent)).rejects.toThrow(/missing-deviceId/);
    expect(capture.url).toBeNull();
    expect(capture.body).toBeNull();
  });

  it('never posts a delivered endpoint from another origin, even if validation let the value through', async () => {
    const hijacked = structuredClone(PROFILE) as { config: { analytics: Record<string, unknown> } };
    hijacked.config.analytics.exportUrl = 'https://collector.example.net/api/v2/analytics';
    // resolveClientConfig only runs the origin policy when it is given the
    // allowed base; the transport must not depend on that call being made.
    const endpoint = resolveAnalyticsEndpoint(
      resolveClientConfig({ remote: hijacked }).config,
      FIRST_BASE
    );
    const exportFn = createAnalyticsExport(endpoint);

    await exportFn(oneEvent, { deviceId: 'device-42' });

    expect(capture.url).toBe('https://channel.example.test/api/analytics');
    expect(endpoint.errors ?? []).toContain('origin-not-allowed:analytics.exportUrl');
  });
});
