/**
 * CrashReporter — Integration tests
 *
 * Exercises the full crash-reporting pipeline:
 *   setupCrashReporting → unhandled error capture → getPendingCrashes →
 *   flushCrashReports → exportFn
 *
 * Uses the real core CrashReporter module (captureError, saveCrash, etc.)
 * and the webOS adapter's window handler wiring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureError, saveCrash, getPendingCrashes, handleUnhandledError } from '@ctv/core';
import { setupCrashReporting, flushCrashReports } from '../../src/Adapter/CrashReporter';

function makeStore() {
  const store: Record<string, string> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, val: string) => {
      store[key] = val;
    },
    remove: (key: string) => {
      delete store[key];
    },
  };
}

describe('CrashReporterIntegration', () => {
  let savedOnerror: Window['onerror'];

  beforeEach(() => {
    savedOnerror = window.onerror;
  });

  afterEach(() => {
    window.onerror = savedOnerror;
  });

  it('full pipeline: capture → save → flush → exportFn receives the report', async () => {
    const store = makeStore();
    const exportFn = vi.fn(async () => {});

    // Save a crash via the core module
    handleUnhandledError(new Error('Something went wrong'), store);

    // Flush and verify the export function received it
    flushCrashReports(store, exportFn);

    // Wait for the async export to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(exportFn).toHaveBeenCalledTimes(1);
    const calls = exportFn.mock.calls as unknown[][];
    const crashes = calls[0][0] as Array<Record<string, unknown>>;
    expect(crashes).toHaveLength(1);
    expect(crashes[0].errorMessage).toBe('Something went wrong');
    expect(crashes[0].errorName).toBe('Error');

    // After successful flush, pending crashes should be cleared
    expect(getPendingCrashes(store)).toHaveLength(0);
  });

  it('flushCrashReports with no pending crashes does not call exportFn', async () => {
    const store = makeStore();
    const exportFn = vi.fn(async () => {});

    flushCrashReports(store, exportFn);
    await new Promise((r) => setTimeout(r, 50));

    expect(exportFn).not.toHaveBeenCalled();
  });

  it('flushCrashReports with no exportFn leaves crashes in queue', async () => {
    const store = makeStore();
    saveCrash(store, captureError(new Error('Queued crash')));

    flushCrashReports(store, undefined);
    await new Promise((r) => setTimeout(r, 50));

    expect(getPendingCrashes(store)).toHaveLength(1);
  });

  it('setupCrashReporting captures an unhandled window error and stores it', () => {
    const store = makeStore();
    setupCrashReporting(store);

    // Simulate window.onerror being called
    const handler = window.onerror;
    expect(handler).not.toBeNull();
    const shouldSuppress = handler!(
      'Simulated error',
      'app.js',
      1,
      0,
      new Error('Simulated error')
    );

    // Returns true = suppressed
    expect(shouldSuppress).toBe(true);
    const crashes = getPendingCrashes(store);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].errorMessage).toBe('Simulated error');
  });

  it('setupCrashReporting captures an unhandled rejection via event listener', () => {
    const store = makeStore();
    setupCrashReporting(store);

    // Dispatch a rejection event
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', {
      value: new Error('Rejected promise'),
      writable: false,
    });
    window.dispatchEvent(event as unknown as PromiseRejectionEvent);

    // The event listener registered by setupCrashReporting should have captured it
    const crashes = getPendingCrashes(store);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].errorMessage).toBe('Rejected promise');
  });

  it('full pipeline with multiple crashes: all are exported in order', async () => {
    const store = makeStore();
    saveCrash(store, captureError(new Error('First crash')));
    saveCrash(store, captureError(new Error('Second crash')));
    saveCrash(store, captureError(new Error('Third crash')));

    const exportFn = vi.fn(async () => {});
    flushCrashReports(store, exportFn);
    await new Promise((r) => setTimeout(r, 50));

    expect(exportFn).toHaveBeenCalledTimes(1);
    const calls = exportFn.mock.calls as unknown[][];
    const crashes = calls[0][0] as Array<Record<string, unknown>>;
    expect(crashes).toHaveLength(3);
    expect(crashes[0].errorMessage).toBe('First crash');
    expect(crashes[1].errorMessage).toBe('Second crash');
    expect(crashes[2].errorMessage).toBe('Third crash');
  });

  it('clearCrashes removes the queue after a successful export (verified state)', async () => {
    const store = makeStore();
    saveCrash(store, captureError(new Error('Test')));

    const exportFn = vi.fn(async () => {});
    flushCrashReports(store, exportFn);
    await new Promise((r) => setTimeout(r, 50));

    expect(getPendingCrashes(store)).toHaveLength(0);
  });

  it('handleUnhandledError tags screenName as unknown', () => {
    const store = makeStore();
    handleUnhandledError(new Error('Unhandled!'), store);
    const crashes = getPendingCrashes(store);
    expect(crashes[0].screenName).toBe('unknown');
  });

  it('crash reports are capped at MAX_CRASHES (10) — overflow is discarded oldest-first', () => {
    const store = makeStore();
    for (let i = 0; i < 15; i++) {
      saveCrash(store, captureError(new Error(`Crash ${i}`)));
    }
    const crashes = getPendingCrashes(store);
    expect(crashes).toHaveLength(10);
    // Oldest 5 were discarded
    expect(crashes[0].errorMessage).toBe('Crash 5');
    expect(crashes[9].errorMessage).toBe('Crash 14');
  });

  it('integration: saveCrash → getPendingCrashes → captureError round-trip preserves all fields', () => {
    const store = makeStore();
    const report = captureError(new Error('Detailed error'), {
      screenName: 'VideoScreen',
      videoId: 'vid-99',
    });
    saveCrash(store, report);

    const retrieved = getPendingCrashes(store);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].errorName).toBe('Error');
    expect(retrieved[0].errorMessage).toBe('Detailed error');
    expect(retrieved[0].screenName).toBe('VideoScreen');
    expect(retrieved[0].videoId).toBe('vid-99');
    expect(retrieved[0].timestamp).toBeTruthy();
  });

  it('flushCrashReports does not throw when exportFn throws (error resilience)', async () => {
    const store = makeStore();
    saveCrash(store, captureError(new Error('Crash to retry')));

    const failingExport = vi.fn(async () => {
      throw new Error('Network error');
    });

    // Should not throw synchronously
    expect(() => flushCrashReports(store, failingExport)).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    // exportFn was called
    expect(failingExport).toHaveBeenCalledTimes(1);
  });
});
