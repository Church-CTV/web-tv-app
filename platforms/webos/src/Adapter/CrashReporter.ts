/**
 * WebOS CrashReporter Adapter — captures unhandled exceptions and reports to server.
 */

interface CrashReporterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

import { captureError, saveCrash, getPendingCrashes, clearCrashes } from '@ctv/core';

/**
 * Set up unhandled error handlers in webOS.
 * Captures window.onerror and unhandledrejection.
 */
export function setupCrashReporting(
  store: CrashReporterStore,
  _exportFn?: (events: unknown[]) => Promise<void>
): void {
  // Capture unhandled exceptions
  window.onerror = (message, source, lineno, colno, error) => {
    const report = captureError(error || new Error(String(message)), { screenName: 'unhandled' });
    saveCrash(store, report);
    return true; // Suppress browser default handler after capturing
  };

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const report = captureError(event.reason || new Error('Unhandled promise rejection'), {
      screenName: 'unhandled',
    });
    saveCrash(store, report);
    event.preventDefault();
  });
}

/**
 * Flush pending crash reports to server on app shutdown.
 */
export function flushCrashReports(
  store: CrashReporterStore,
  exportFn?: (events: unknown[]) => Promise<void>
): void {
  const crashes = getPendingCrashes(store);
  if (crashes.length > 0 && exportFn) {
    exportFn(crashes)
      .catch(() => {
        // If export fails, crashes stay in queue for next launch
      })
      .finally(() => {
        clearCrashes(store);
      });
  }
}
