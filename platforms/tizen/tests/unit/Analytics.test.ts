/**
 * Tizen Analytics — unit tests.
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

describe('Tizen Analytics', () => {
  let exportFn: ReturnType<typeof createAnalyticsExport>;

  beforeEach(() => {
    vi.restoreAllMocks();
    exportFn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
  });

  it('creates an export function', () => {
    expect(typeof exportFn).toBe('function');
  });

  it('returns undefined for empty events', async () => {
    const result = await exportFn([]);
    expect(result).toBeUndefined();
  });

  it('handles missing slashes in export URL', () => {
    const exportFn2 = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', 'api/analytics')
    );
    expect(typeof exportFn2).toBe('function');
  });

  it('rejects on XHR HTTP error status', async () => {
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      Object.defineProperty(this, 'status', { value: 500, writable: true, configurable: true });
      if (this.onload) this.onload();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('Analytics export failed: 500');
  });

  it('rejects on XHR network error', async () => {
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      if (this.onerror) this.onerror();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('network error');
  });

  it('rejects on XHR timeout', async () => {
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      if (this.ontimeout) this.ontimeout();
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('timeout');
  });

  it('rejects on XHR send exception', async () => {
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {
      throw new Error('XHR error');
    });
    await expect(exportFn([{ type: 'test' }])).rejects.toThrow('XHR error');
  });
});
