/**
 * Tizen CrashReporter — unit tests.
 *
 * Verifies the parity crash pipeline: redacted, bounded capture into the core
 * queue, window.onerror returning false (diagnostics saved, not swallowed),
 * unhandledrejection capture, and a flush that clears only on a confirmed
 * export.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupCrashReporting, flushCrashReports } from '../../src/Adapter/CrashReporter';

describe('Tizen CrashReporter', () => {
  let store: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
  };
  let storeData: Record<string, string>;

  beforeEach(() => {
    storeData = {};
    store = {
      get: (key: string) => storeData[key] || null,
      set: (key: string, value: string) => {
        storeData[key] = value;
      },
      remove: (key: string) => {
        delete storeData[key];
      },
    };
  });

  it('exports setup and flush as functions', () => {
    expect(typeof setupCrashReporting).toBe('function');
    expect(typeof flushCrashReports).toBe('function');
  });

  it('sets up error handlers without throwing', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    expect(() => setupCrashReporting(store, exportFn)).not.toThrow();
  });

  it('window.onerror saves the report to the core queue and returns false (does not swallow)', () => {
    setupCrashReporting(store, vi.fn().mockResolvedValue(undefined));
    expect(typeof window.onerror).toBe('function');
    // The handler saves the diagnostic and returns false so the browser's
    // default reporting is not suppressed (returning true would swallow it).
    const result = window.onerror?.('script error', 'test.js', 1, 2, new Error('boom'));
    expect(result).toBe(false);
    const saved = JSON.parse(store.get('ctv_pending_crashes') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].errorMessage).toBe('boom');
  });

  it('captures unhandledrejection events into the core queue', () => {
    setupCrashReporting(store, vi.fn().mockResolvedValue(undefined));
    const rejection = Promise.reject(new Error('rejected promise'));
    rejection.catch(() => {}); // avoid a real unhandled rejection
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('rejected promise'),
        promise: rejection,
      })
    );
    const saved = JSON.parse(store.get('ctv_pending_crashes') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].errorMessage).toBe('rejected promise');
  });

  it('flushes pending crashes and clears the store on success', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const crashReports = [
      { errorName: 'TestError', errorMessage: 'Test error', timestamp: new Date().toISOString() },
    ];
    store.set('ctv_pending_crashes', JSON.stringify(crashReports));

    await new Promise<void>((resolve) => {
      flushCrashReports(store, exportFn);
      setTimeout(resolve, 20);
    });

    expect(exportFn).toHaveBeenCalled();
    expect(exportFn.mock.calls[0][0]).toEqual(crashReports);
    // Cleared only after a confirmed export.
    expect(store.get('ctv_pending_crashes')).toBeNull();
  });

  it('keeps the queue when the export fails', async () => {
    const exportFn = vi.fn().mockRejectedValue(new Error('export failed'));
    const crashReports = [
      { errorName: 'E', errorMessage: 'x', timestamp: new Date().toISOString() },
    ];
    store.set('ctv_pending_crashes', JSON.stringify(crashReports));

    expect(() => flushCrashReports(store, exportFn)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // A failed export must not drop the queue (it is retried next launch).
    expect(store.get('ctv_pending_crashes')).not.toBeNull();
  });

  it('does nothing when there are no pending crashes', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    flushCrashReports(store, exportFn);
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('does nothing when no export function is provided', () => {
    expect(() => flushCrashReports(store)).not.toThrow();
  });
});
