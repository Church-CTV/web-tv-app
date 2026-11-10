/**
 * Tizen initAnalytics — unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { createAnalytics } from '../../src/modules/initAnalytics';
import { Analytics } from '@ctv/core';

describe('Tizen initAnalytics', () => {
  it('creates an analytics instance', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = createAnalytics(
      {
        exportUrl: '/api/analytics',
        exportIntervalSeconds: 60,
        maxEventsPerBatch: 50,
        flushOnError: true,
        retryAttempts: 3,
        retryBaseDelayMs: 1000,
        exportTimeoutSeconds: 10,
      },
      exportFn
    );

    expect(analytics).toBeInstanceOf(Analytics);
  });

  it('tracks an interaction', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = createAnalytics(
      {
        exportUrl: '/api/analytics',
        exportIntervalSeconds: 60,
        maxEventsPerBatch: 50,
        flushOnError: true,
        retryAttempts: 3,
        retryBaseDelayMs: 1000,
        exportTimeoutSeconds: 10,
      },
      exportFn
    );

    analytics.trackInteraction('play', 'video-card', 'v1');
    expect(analytics).toBeDefined();
  });

  it('tracks a screen view', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = createAnalytics(
      {
        exportUrl: '/api/analytics',
        exportIntervalSeconds: 60,
        maxEventsPerBatch: 50,
        flushOnError: true,
        retryAttempts: 3,
        retryBaseDelayMs: 1000,
        exportTimeoutSeconds: 10,
      },
      exportFn
    );

    analytics.trackScreenView('grid');
    expect(analytics).toBeDefined();
  });

  it('shutdown does not throw', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = createAnalytics(
      {
        exportUrl: '/api/analytics',
        exportIntervalSeconds: 60,
        maxEventsPerBatch: 50,
        flushOnError: true,
        retryAttempts: 3,
        retryBaseDelayMs: 1000,
        exportTimeoutSeconds: 10,
      },
      exportFn
    );

    expect(() => analytics.shutdown()).not.toThrow();
  });
});
