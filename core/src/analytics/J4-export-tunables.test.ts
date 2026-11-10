/**
 * WEB-052g follow-up: the delivered tunables have to *do* something.
 *
 * `analytics.exportIntervalSeconds` and `analytics.maxEventsPerBatch` arrive in
 * `ExportConfig` from the delivered channel profile, and both were carried
 * without effect: nothing scheduled a periodic export (telemetry left the device
 * only on unload, so a television that stays on for days never exports while it
 * is on), and `doFlush` sent every pending event in one request regardless of the
 * batch cap the server rate-limits around. A value a client parses and ignores is
 * the failure CONFIGURATION.md is written against, so both are asserted here.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { Analytics } from './Analytics';
import type { ExportConfig } from '@ctv/shared/contracts/analytics';

const BASE: ExportConfig = {
  exportUrl: 'https://channel.example.test/api/v2/analytics',
  exportIntervalSeconds: 2,
  maxEventsPerBatch: 50,
  flushOnError: true,
  retryAttempts: 1,
  retryBaseDelayMs: 0,
  exportTimeoutSeconds: 15,
};

function optedIn(engine: Analytics): Analytics {
  engine.setOptOut(false);
  return engine;
}

// The in-memory caps are per category (`MEMORY_CAPS`: screen views 50, plays
// 100, deep links 50, errors 50), so a queue larger than a batch cap is built by
// spreading across categories rather than by overfilling one of them.
function trackSpread(engine: Analytics, perCategory: number): void {
  for (let i = 0; i < perCategory; i++) engine.trackScreenView(`screen-${i}`);
  for (let i = 0; i < perCategory; i++) engine.trackInteraction('select', `target-${i}`);
  for (let i = 0; i < perCategory; i++) engine.trackContentPlay(`video-${i}`, 'title');
  for (let i = 0; i < perCategory; i++) engine.trackDeepLink(`video-${i}`, 'video', 'rowlist');
}

describe('the in-memory caps are per event category, not one shared budget', () => {
  it('four categories at 30 each are all held', () => {
    const engine = optedIn(new Analytics());
    engine.init(BASE, async () => {});
    trackSpread(engine, 30);
    expect(engine.getPendingCount()).toBe(120);
  });

  it('one category stops at its own cap and leaves the others alone', () => {
    const engine = optedIn(new Analytics());
    engine.init(BASE, async () => {});
    for (let i = 0; i < 80; i++) engine.trackInteraction('select', `target-${i}`);
    for (let i = 0; i < 20; i++) engine.trackScreenView(`screen-${i}`);
    // interactions stop at their own cap of 50; the 20 screen views are still
    // accepted because they are a different category. Pre-fix the whole queue
    // stopped growing at 50.
    expect(engine.getPendingCount()).toBe(70);
  });
});

describe('analytics export scheduling from the delivered interval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports pending events on the delivered interval without asking', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, exportIntervalSeconds: 2 }, exportFn);
    engine.trackInteraction('select', 'card');

    await vi.advanceTimersByTimeAsync(1000);
    expect(exportFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(exportFn.mock.calls[0][0]).toHaveLength(1);
  });

  it('sends nothing when there is nothing queued', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, exportIntervalSeconds: 1 }, exportFn);

    await vi.advanceTimersByTimeAsync(5000);
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('an interval of zero disables the schedule: the kill switch is a value, not a code edit', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, exportIntervalSeconds: 0 }, exportFn);
    engine.trackInteraction('select', 'card');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('telemetry switched off at the profile level exports nothing on a timer', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = new Analytics();
    engine.setOptOut(true);
    engine.init({ ...BASE, exportIntervalSeconds: 1 }, exportFn);
    engine.trackInteraction('select', 'card');

    await vi.advanceTimersByTimeAsync(5000);
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('shutdown stops the schedule', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, exportIntervalSeconds: 1 }, exportFn);
    engine.trackInteraction('select', 'card');
    await vi.advanceTimersByTimeAsync(1000);
    engine.shutdown();
    const afterShutdown = exportFn.mock.calls.length;
    engine.trackInteraction('select', 'card-2');

    await vi.advanceTimersByTimeAsync(5000);
    // Only the shutdown flush itself may have exported; the schedule is gone.
    expect(exportFn.mock.calls.length).toBe(afterShutdown);
  });
});

describe('a disabled telemetry path creates no timer at all', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opting out clears the schedule; opting in starts exactly one', () => {
    // The soak gate counts `setInterval` minus `clearInterval` and allows two
    // session-long timers (overhang clock, profile poll). Telemetry is the third
    // only while it is actually on: a viewer who never consented, or a profile
    // kill switch, must leave no timer behind - a disabled path may still cost a
    // wakeup every interval.
    const engine = new Analytics();
    const timers = vi.spyOn(globalThis, 'setInterval');
    const clears = vi.spyOn(globalThis, 'clearInterval');

    engine.setOptOut(true);
    engine.init({ ...BASE, exportIntervalSeconds: 1 }, async () => {});
    expect(timers).not.toHaveBeenCalled();

    engine.setOptOut(false);
    expect(timers).toHaveBeenCalledTimes(1);
    // Repeating the call must not stack a second schedule.
    engine.setOptOut(false);
    engine.setOptOut(false);
    expect(timers).toHaveBeenCalledTimes(1);

    engine.setOptOut(true);
    expect(clears).toHaveBeenCalledTimes(1);

    timers.mockRestore();
    clears.mockRestore();
  });
});

describe('the delivered batch cap is the cap on the wire', () => {
  it('splits a queue larger than the cap into batches of the cap', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, maxEventsPerBatch: 50 }, exportFn);
    trackSpread(engine, 30);

    const flushed = await engine.flush();
    expect(flushed).toHaveLength(120);
    expect(exportFn.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([50, 50, 20]);
  });

  it('one batch when the cap covers the queue', async () => {
    const exportFn = vi.fn(async () => {});
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, maxEventsPerBatch: 200 }, exportFn);
    trackSpread(engine, 3);

    await engine.flush();
    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(exportFn.mock.calls[0][0]).toHaveLength(12);
  });

  it('a batch failure retries that batch and queues only what never landed', async () => {
    const exportFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('export failed: 429'))
      .mockRejectedValueOnce(new Error('export failed: 429'))
      .mockResolvedValue(undefined);
    const engine = optedIn(new Analytics());
    engine.init({ ...BASE, maxEventsPerBatch: 2, retryAttempts: 2, retryBaseDelayMs: 0 }, exportFn);
    trackSpread(engine, 1);

    // A batch that never lands is queued, and it must not stop the batches
    // behind it: one 429 cannot strand the whole session's telemetry.
    // 4 events (one per category), cap 2: batch A fails twice and is queued,
    // batch B lands. Three calls of 2/2/2, and exactly the 2 queued events owed.
    const flushed = await engine.flush();
    expect(flushed).toHaveLength(4);
    expect(exportFn.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([2, 2, 2]);
    expect(engine.getRetryQueueCount()).toBe(2);
  });
});
