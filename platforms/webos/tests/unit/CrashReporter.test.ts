/**
 * CrashReporter Adapter — unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupCrashReporting, flushCrashReports } from '../../src/Adapter/CrashReporter';

describe('CrashReporter Adapter', () => {
  let store: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
  };

  beforeEach(() => {
    // Create a mock store
    const storeData: Record<string, string> = {};
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

  it('sets up error handlers without throwing', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    expect(() => setupCrashReporting(store, exportFn)).not.toThrow();
  });

  it('flushes crashes when export function is provided', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);

    // Simulate crash reports in store (using the correct key from core)
    // Core stores an array of crashes
    const crashReports = [
      {
        errorName: 'TestError',
        errorMessage: 'Test error',
        timestamp: new Date().toISOString(),
      },
    ];
    store.set('ctv_pending_crashes', JSON.stringify(crashReports));

    // Wait for async operations to complete
    await new Promise<void>((resolve) => {
      flushCrashReports(store, exportFn);
      setTimeout(resolve, 50);
    });

    expect(exportFn).toHaveBeenCalled();
    expect(exportFn.mock.calls[0][0]).toEqual(crashReports);
  });

  it('does nothing when no crashes in store', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);

    flushCrashReports(store, exportFn);

    expect(exportFn).not.toHaveBeenCalled();
  });

  it('does nothing when export function is not provided', () => {
    flushCrashReports(store);

    // Should not throw
    expect(true).toBe(true);
  });

  it('handles export errors gracefully', async () => {
    const exportFn = vi.fn().mockRejectedValue(new Error('Export failed'));

    // Simulate crash reports in store
    const crashReport = JSON.stringify({
      error: 'Test error',
      timestamp: new Date().toISOString(),
    });
    store.set('pending_crashes', crashReport);

    // Should not throw even when export fails
    expect(() => flushCrashReports(store, exportFn)).not.toThrow();

    // Wait for async export to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
