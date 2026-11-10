/**
 * Vizio initCrashReporting — unit tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCrashReporter } from '../../src/modules/initCrashReporting';

describe('Vizio initCrashReporting', () => {
  beforeEach(() => {
    // Clean up any error listeners from previous tests
    vi.restoreAllMocks();
  });

  it('sets up crash reporting without throwing', () => {
    const storage = {
      get: () => null,
      set: () => {},
      remove: () => {},
    };
    const exportFn = vi.fn().mockResolvedValue(undefined);

    expect(() => createCrashReporter(storage, exportFn)).not.toThrow();
  });

  it('captures unhandled errors via window.onerror', () => {
    const storage = {
      get: () => null,
      set: () => {},
      remove: () => {},
    };
    const exportFn = vi.fn().mockResolvedValue(undefined);

    createCrashReporter(storage, exportFn);

    const result = window.onerror?.('test error', 'test.js', 1, 2, new Error('test'));
    expect(result).toBe(true);
  });

  it('handles unhandled rejection events without throwing', () => {
    const storage = {
      get: () => null,
      set: () => {},
      remove: () => {},
    };
    const exportFn = vi.fn().mockResolvedValue(undefined);

    createCrashReporter(storage, exportFn);

    // Use an actual rejection but prevent the unhandled error
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
    };
    window.addEventListener('unhandledrejection', rejectionHandler);

    const rejection = Promise.reject(new Error('rejected'));
    rejection.catch(() => {}); // Prevent actual unhandled rejection

    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('rejected'),
        promise: rejection,
      })
    );

    window.removeEventListener('unhandledrejection', rejectionHandler);
  });
});
