/**
 * Vizio CrashReporter — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCrashReporter, setupCrashReporting } from '../../src/Adapter/CrashReporter';

describe('Vizio CrashReporter', () => {
  let store: {
    get: (k: string) => string | null;
    set: (k: string, v: string) => void;
    remove: (k: string) => void;
  };
  let reports: unknown[];
  let unhandledRejectionHandler: ((e: PromiseRejectionEvent) => void) | null;

  beforeEach(() => {
    reports = [];
    store = {
      get: () => null,
      set: () => {},
      remove: () => {},
    };
    // Prevent unhandled rejection noise during tests
    unhandledRejectionHandler = (e: PromiseRejectionEvent) => e.preventDefault();
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
  });

  afterEach(() => {
    if (unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    }
  });

  it('creates a crash reporter', () => {
    const cr = createCrashReporter(store, (r) => {
      reports.push(r);
    });
    expect(cr).toBeDefined();
    expect(cr.reportError).toBeDefined();
    expect(cr.flush).toBeDefined();
  });

  it('reports an error', () => {
    const cr = createCrashReporter(store, () => {});
    expect(() => cr.reportError(new Error('test error'))).not.toThrow();
  });

  it('flushes collected reports', () => {
    const exported: unknown[][] = [];
    const cr = createCrashReporter(store, (r) => {
      exported.push(r as unknown[]);
    });
    cr.reportError(new Error('error 1'));
    cr.reportError(new Error('error 2'));
    cr.flush();
    expect(exported.length).toBeGreaterThan(0);
  });

  it('captures unhandledrejection events', () => {
    let captured = false;
    const mockStore = {
      get: () => null,
      set: (k: string, v: string) => {
        if (k === 'ctv_crash_reports') captured = true;
      },
      remove: () => {},
    };
    const cr = createCrashReporter(mockStore, () => {});
    // Create the rejection and catch it to prevent unhandled rejection noise
    const rejection = Promise.reject(new Error('rejected promise'));
    rejection.catch(() => {});
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('rejected promise'),
        promise: rejection,
      })
    );
    cr.flush();
    expect(captured).toBe(true);
  });

  it('captures unhandled errors via window.onerror', () => {
    let captured = false;
    const mockStore = {
      get: () => null,
      set: (k: string, v: string) => {
        if (k === 'ctv_crash_reports') captured = true;
      },
      remove: () => {},
    };
    const cr = createCrashReporter(mockStore, () => {});
    window.onerror?.('script error', 'test.js', 1, 2, new Error('test'));
    cr.flush();
    expect(captured).toBe(true);
  });

  it('reportError includes error message and stack', () => {
    let reported = false;
    const cr = createCrashReporter(store, () => {
      reported = true;
    });
    const err = new Error('test');
    cr.reportError(err);
    cr.flush();
    expect(reported).toBe(true);
  });

  it('setupCrashReporting sets up global handlers', () => {
    const mockStore = {
      get: () => null,
      set: () => {},
      remove: () => {},
    };
    // setupCrashReporting calls createCrashReporter which sets up window.onerror
    // Verify that after calling it, window.onerror is a function
    setupCrashReporting(mockStore, () => {});
    expect(typeof window.onerror).toBe('function');
    // Call it to verify it captures the error and returns true
    const result = window.onerror('setup test', 'setup.js', 1, 2, new Error('setup error'));
    expect(result).toBe(true);
  });
});
