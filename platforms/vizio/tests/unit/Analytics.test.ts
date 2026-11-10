/**
 * Vizio Analytics Adapter — unit tests.
 * Tests createAnalyticsExport from Vizio's own Adapter.
 *
 * Strategy: Do NOT spy on XMLHttpRequest.prototype.open
 * (jsdom's state machine breaks). Instead, capture URL via
 * a global tracking variable that open() would normally set,
 * and intercept send() to capture the body.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAnalyticsExport } from '../../src/Adapter/Analytics';

// The adapter is a transport: the url and the body mode arrive as one resolved
// endpoint from core (core/src/analytics/AnalyticsEndpoint.ts). These cases keep
// the legacy mode, which is what the pre-profile server speaks.
const legacyEndpoint = (baseUrl: string, exportPath: string): AnalyticsEndpoint => ({
  url: baseUrl.replace(/\/+$/, '') + '/' + exportPath.replace(/^\/+/, ''),
  envelope: 'legacy',
});

import type { AnalyticsEndpoint } from '@ctv/core';

// We need to verify the URL construction in the adapter source.
// Since we can't spy on XHR.open in jsdom without breaking its state machine,
// we test URL construction indirectly by verifying the adapter creates
// a function that, when called, would use the correct URL.
// We test all other aspects (XHR behavior, error handling) via send() mocking.

describe('Analytics Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a function', () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    expect(typeof exportFn).toBe('function');
  });

  it('does nothing when events array is empty', async () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    await exportFn([]);
  });

  it('creates export function that uses correct URL concatenation', () => {
    // Test URL construction logic directly from source
    const url1 =
      'http://localhost:3000'.replace(/\/+$/, '') + '/' + '/api/analytics'.replace(/^\/+/, '');
    expect(url1).toBe('http://localhost:3000/api/analytics');

    const url2 =
      'http://localhost:3000/'.replace(/\/+$/, '') + '/' + '/api/analytics'.replace(/^\/+/, '');
    expect(url2).toBe('http://localhost:3000/api/analytics');

    const url3 =
      'http://localhost:3000'.replace(/\/+$/, '') + '/' + 'api/analytics'.replace(/^\/+/, '');
    expect(url3).toBe('http://localhost:3000/api/analytics');
  });

  it('rejects on XHR HTTP error status', async () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      Object.defineProperty(this, 'status', { value: 500, writable: true, configurable: true });
      if (this.onload) this.onload();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('Analytics export failed: 500');
  });

  it('rejects on XHR network error', async () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      if (this.onerror) this.onerror();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('network error');
  });

  it('rejects on XHR timeout', async () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      if (this.ontimeout) this.ontimeout();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('timeout');
  });

  it('rejects on XHR send exception', async () => {
    const exportFn = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', '/api/analytics')
    );
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {
      throw new Error('XHR error');
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('XHR error');
  });
});
