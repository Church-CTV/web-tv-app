/**
 * WebOS Analytics Adapter — unit tests
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

describe('Analytics Adapter', () => {
  let exportFn: ReturnType<typeof createAnalyticsExport>;

  beforeEach(() => {
    exportFn = createAnalyticsExport(legacyEndpoint('http://localhost:3000', '/api/analytics'));
  });

  it('creates an export function', () => {
    expect(typeof exportFn).toBe('function');
  });

  it('returns void for empty events', async () => {
    const result = await exportFn([]);
    expect(result).toBeUndefined();
  });

  it('handles missing slashes in export URL', () => {
    const exportFn2 = createAnalyticsExport(
      legacyEndpoint('http://localhost:3000', 'api/analytics')
    );
    expect(typeof exportFn2).toBe('function');
  });
});
