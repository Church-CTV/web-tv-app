/**
 * WebOS Analytics Adapter — export behavior tests.
 *
 * Covers:
 * - XMLHttpRequest POST with events (success path)
 * - Error response (non-2xx status)
 * - Network error
 * - Timeout
 * - URL construction (trailing/leading slashes)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnalyticsExport } from '../../src/Adapter/Analytics';

// The adapter is a transport: the url and the body mode arrive as one resolved
// endpoint from core (core/src/analytics/AnalyticsEndpoint.ts). These cases run
// in legacy mode, which is what a pre-profile server speaks. Where a case is
// about url construction it goes through the real resolver, so the join under
// test is the one production uses.
import {
  ANALYTICS_LEGACY_PATH,
  resolveAnalyticsEndpoint,
  resolveClientConfig,
  type AnalyticsEndpoint,
} from '@ctv/core';

const CODE_DEFAULTS = resolveClientConfig({ bundled: null, remote: null }).config;
const legacyEndpoint = (baseUrl: string, exportPath: string): AnalyticsEndpoint =>
  exportPath === ANALYTICS_LEGACY_PATH
    ? resolveAnalyticsEndpoint(CODE_DEFAULTS, baseUrl)
    : {
        url: baseUrl.replace(/\/+$/, '') + '/' + exportPath.replace(/^\/+/, ''),
        envelope: 'legacy',
      };

/**
 * XHR mock factory.
 * Each test gets a fresh mock instance via vi.stubGlobal.
 * Tests access the instance via `mockInstances[0]` (the last constructed).
 */
let mockInstances: MockXHRInstance[] = [];

class MockXHRInstance {
  openMethod: string | null = null;
  openArgs: [string, string, boolean] | null = null;
  setRequestHeaderCalls: Array<[string, string]> = [];
  timeout = 0;
  status = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  sentBody: string | null = null;

  constructor() {
    mockInstances.push(this);
  }

  open(method: string, url: string, async: boolean): void {
    this.openMethod = method;
    this.openArgs = [method, url, async];
  }

  setRequestHeader(name: string, value: string): void {
    this.setRequestHeaderCalls.push([name, value]);
  }

  send(body: string | null): void {
    this.sentBody = body;
  }
}

function getInstance(): MockXHRInstance {
  return mockInstances[mockInstances.length - 1];
}

beforeEach(() => {
  mockInstances = [];
  vi.stubGlobal('XMLHttpRequest', MockXHRInstance);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAnalyticsExport', () => {
  it('returns a function', () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    expect(typeof fn).toBe('function');
  });

  it('sends a POST request with JSON events on success', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    // The XHR should have been opened with POST
    const xhr = getInstance();
    expect(xhr.openMethod).toBe('POST');
    expect(xhr.openArgs?.[1]).toBe('http://localhost:3000/api/analytics');
    expect(xhr.openArgs?.[2]).toBe(true);

    // Check content type header was set
    expect(xhr.setRequestHeaderCalls).toContainEqual(['Content-Type', 'application/json']);

    // Timeout was set
    expect(xhr.timeout).toBe(15000);

    // Body was sent as JSON
    expect(xhr.sentBody).toBe(JSON.stringify(events));

    // Resolve with success status
    xhr.status = 200;
    xhr.onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects on non-2xx status code (500)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 500;
    xhr.onload?.();

    await expect(promise).rejects.toThrow('Analytics export failed: 500');
  });

  it('rejects on 4xx status code (404)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 404;
    xhr.onload?.();

    await expect(promise).rejects.toThrow('Analytics export failed: 404');
  });

  it('rejects on network error', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.onerror?.();

    await expect(promise).rejects.toThrow('Analytics export network error');
  });

  it('rejects on timeout', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.ontimeout?.();

    await expect(promise).rejects.toThrow('Analytics export timeout');
  });

  it('normalizes trailing slash in server base URL', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000/', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    expect(xhr.openArgs?.[1]).toBe('http://localhost:3000/api/analytics');

    xhr.status = 200;
    xhr.onload?.();
    await promise;
  });

  it('normalizes leading slash in export URL', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', 'api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    expect(xhr.openArgs?.[1]).toBe('http://localhost:3000/api/analytics');

    xhr.status = 200;
    xhr.onload?.();
    await promise;
  });

  it('normalizes repeated trailing slashes in the launch base', async () => {
    const fn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000///', ANALYTICS_LEGACY_PATH)
    );
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    expect(xhr.openArgs?.[1]).toBe('http://localhost:3000/api/analytics');

    xhr.status = 200;
    xhr.onload?.();
    await promise;
  });

  it('rejects on 304 Not Modified (only 2xx succeeds)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 304;
    xhr.onload?.();

    await expect(promise).rejects.toThrow('Analytics export failed: 304');
  });

  it('rejects on 300 status (boundary — not in 2xx range)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 300;
    xhr.onload?.();

    await expect(promise).rejects.toThrow('Analytics export failed: 300');
  });

  it('resolves on 200 (lower boundary)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 200;
    xhr.onload?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves on 299 (upper boundary of 2xx range)', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
    const events = [{ type: 'play', id: 'v1' }];

    const promise = fn(events);

    const xhr = getInstance();
    xhr.status = 299;
    xhr.onload?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it('returns immediately for empty events without sending XHR', async () => {
    const fn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));

    const promise = fn([]);

    // No XHR should have been constructed
    expect(mockInstances.length).toBe(0);
    await expect(promise).resolves.toBeUndefined();
  });
});
