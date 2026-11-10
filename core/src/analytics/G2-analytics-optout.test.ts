/**
 * G2 Privacy / Data-collection - Analytics opt-out tests
 *
 * Verifies:
 * 1. Analytics defaults to opted-out (privacy by default)
 * 2. No events are collected when opted out
 * 3. Export is skipped when opted out
 * 4. Events are collected and exported when opted in
 * 5. isOptedOut/setOptOut work correctly
 */

import { describe, it, expect, vi } from 'vitest';
import { Analytics } from './Analytics';

const exportConfig = {
  exportUrl: '/analytics',
  exportIntervalSeconds: 300,
  maxEventsPerBatch: 50,
  flushOnError: true,
  retryAttempts: 3,
  retryBaseDelayMs: 10,
  exportTimeoutSeconds: 10,
};

describe('G2 Analytics opt-out', () => {
  it('defaults to opted-out', () => {
    const analytics = new Analytics();
    expect(analytics.isOptedOut()).toBe(true);
  });

  it('isOptedOut reflects setOptOut calls', () => {
    const analytics = new Analytics();
    expect(analytics.isOptedOut()).toBe(true);
    analytics.setOptOut(false);
    expect(analytics.isOptedOut()).toBe(false);
    analytics.setOptOut(true);
    expect(analytics.isOptedOut()).toBe(true);
  });

  it('does not collect events when opted out', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(exportConfig, exportFn);
    // default is opted out
    analytics.trackScreenView('Home');
    analytics.trackContentPlay('video-1', 'Test');
    analytics.trackInteraction('back');
    expect(analytics.getPendingCount()).toBe(0);
  });

  it('skips export when opted out', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(exportConfig, exportFn);
    const flushed = await analytics.flush();
    expect(exportFn).not.toHaveBeenCalled();
    expect(flushed).toHaveLength(0);
  });

  it('collects and exports when opted in', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(exportConfig, exportFn);
    analytics.setOptOut(false);
    analytics.trackScreenView('Home');
    expect(analytics.getPendingCount()).toBe(1);
    const flushed = await analytics.flush();
    expect(flushed).toHaveLength(1);
    expect(exportFn).toHaveBeenCalled();
  });

  it('flushForShutdown skips export when opted out', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(exportConfig, exportFn);
    const flushed = await analytics.flushForShutdown();
    expect(exportFn).not.toHaveBeenCalled();
    expect(flushed).toHaveLength(0);
  });

  it('flushForShutdown exports when opted in', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(exportConfig, exportFn);
    analytics.setOptOut(false);
    analytics.trackScreenView('Home');
    const flushed = await analytics.flushForShutdown();
    expect(exportFn).toHaveBeenCalled();
    expect(flushed).toHaveLength(1);
  });
});
