/**
 * Tizen initCrashReporting — unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCrashReporter, flushCrashReports } from '../../src/modules/initCrashReporting';
import * as CrashReporterAdapter from '../../src/Adapter/CrashReporter';

describe('Tizen initCrashReporting', () => {
  it('sets up crash reporting without throwing', () => {
    const storage = { get: () => null, set: () => {}, remove: () => {} };
    const exportFn = vi.fn().mockResolvedValue(undefined);
    expect(() => createCrashReporter(storage, exportFn)).not.toThrow();
  });

  it('installs a window.onerror handler that saves to the core queue and returns false (does not swallow)', () => {
    const data: Record<string, string> = {};
    const storage = {
      get: (k: string) => data[k] || null,
      set: (k: string, v: string) => {
        data[k] = v;
      },
      remove: (k: string) => {
        delete data[k];
      },
    };
    createCrashReporter(storage, vi.fn().mockResolvedValue(undefined));
    // Proves the module delegated to the adapter's setupCrashReporting
    // (only that handler is installed and it returns false, not true).
    expect(typeof window.onerror).toBe('function');
    const result = window.onerror?.('test error', 'test.js', 1, 2, new Error('test'));
    expect(result).toBe(false);
    const saved = JSON.parse(storage.get('ctv_pending_crashes') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].errorMessage).toBe('test');
  });

  it('re-exports flushCrashReports from the adapter for app-layer shutdown wiring', () => {
    expect(typeof flushCrashReports).toBe('function');
    expect(flushCrashReports).toBe(CrashReporterAdapter.flushCrashReports);
  });
});
