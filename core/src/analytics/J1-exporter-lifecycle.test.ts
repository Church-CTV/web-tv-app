import { describe, it, expect } from 'vitest';
import { Analytics } from './Analytics';
import type { ExportConfig } from '@ctv/shared/contracts/analytics';

const config: ExportConfig = {
  exportUrl: 'https://example.com/collect',
  batchIntervalMs: 10,
  batchSize: 50,
  retryAttempts: 3,
  retryBaseDelayMs: 1000,
};

describe('Analytics exporter abort-on-unload and settlement', () => {
  it('flushForShutdown calls exportFn once with all pending events', async () => {
    let exportCount = 0;
    let lastEvents = [];
    const analytics = new Analytics();
    analytics.init(config, (events) => {
      exportCount++;
      lastEvents = events;
      return Promise.resolve();
    });
    analytics.setOptOut(false);

    analytics.trackInteraction('button', 'clicked', 'test');
    analytics.trackScreenView('settings');

    const flushed = await analytics.flushForShutdown();
    expect(exportCount).toBe(1);
    expect(flushed.length).toBe(2);
    expect(lastEvents.length).toBe(2);
    analytics.shutdown();
  });

  it('flushForShutdown after reset exports nothing', async () => {
    let exportCount = 0;
    const analytics = new Analytics();
    analytics.init(config, () => {
      exportCount++;
      return Promise.resolve();
    });
    analytics.setOptOut(false);
    analytics.reset();

    await analytics.flushForShutdown();
    expect(exportCount).toBe(0);
  });

  it('flushForShutdown dedupes events already exported by a batch flush', async () => {
    let exportedTotal = 0;
    const analytics = new Analytics();
    analytics.init(config, (events) => {
      exportedTotal += events.length;
      return Promise.resolve();
    });
    analytics.setOptOut(false);

    analytics.trackScreenView('test');
    expect(analytics.getPendingCount()).toBe(1);

    // Batch flush first
    await analytics.flush();
    expect(exportedTotal).toBe(1);
    expect(analytics.getPendingCount()).toBe(0);

    // Shutdown should not export the same event again
    const flushed = await analytics.flushForShutdown();
    expect(flushed.length).toBe(0);
    expect(exportedTotal).toBe(1);
    analytics.shutdown();
  });

  it('flushForShutdown discards events on export failure', async () => {
    let exportCount = 0;
    const analytics = new Analytics();
    analytics.init(config, () => {
      exportCount++;
      return Promise.reject(new Error('network'));
    });
    analytics.setOptOut(false);

    analytics.trackScreenView('test');
    const flushed = await analytics.flushForShutdown();
    expect(exportCount).toBe(1);
    expect(flushed.length).toBe(1);
    expect(analytics.getPendingCount()).toBe(0);
    analytics.shutdown();
  });
});
