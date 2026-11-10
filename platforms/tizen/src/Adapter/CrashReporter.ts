/**
 * Tizen CrashReporter Adapter — captures unhandled exceptions and reports to
 * the server.
 *
 * Ports the verified webOS parity implementation (source of truth #1) and the
 * canonical @ctv/core crash primitives, so every report is:
 *   - redacted (sensitive values stripped) before it is stored or exported,
 *   - bounded (the core queue caps the number of retained reports, so a
 *     crash-loop can no longer grow the store unboundedly),
 *   - removed from the store only after a CONFIRMED export (a failed export is
 *     retried on the next launch instead of being lost).
 */

import { captureError, saveCrash, getPendingCrashes, clearCrashes } from '@ctv/core';

interface CrashReporterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

// The store routed to by the single shared unhandledrejection listener. Kept
// at module scope and updated by every setupCrashReporting call so we never
// stack duplicate window listeners across repeated setup calls (a slow leak
// the per-call addEventListener pattern had).
let currentStore: CrashReporterStore | null = null;
let rejectionHandlerInstalled = false;

function ensureRejectionHandler(): void {
  if (rejectionHandlerInstalled) return;
  rejectionHandlerInstalled = true;
  window.addEventListener('unhandledrejection', (event) => {
    if (!currentStore) return;
    const report = captureError(event.reason || new Error('Unhandled promise rejection'), {
      screenName: 'unhandled',
    });
    saveCrash(currentStore, report);
    event.preventDefault();
  });
}

/**
 * Set up unhandled-error capture for Tizen.
 * Wires window.onerror and a single shared unhandledrejection listener. Each
 * captured error is redacted and persisted to the bounded core crash queue.
 */
export function setupCrashReporting(
  store: CrashReporterStore,
  _exportFn?: (events: unknown[]) => Promise<void>
): void {
  currentStore = store;

  window.onerror = (message, source, lineno, colno, error) => {
    const report = captureError(error || new Error(String(message)), { screenName: 'unhandled' });
    saveCrash(store, report);
    // Return false: the diagnostic is saved, but we must NOT suppress the
    // browser's default error reporting. Returning true would swallow the
    // error (a known anti-pattern; see the platform parity rules).
    return false;
  };

  ensureRejectionHandler();
}

/**
 * Flush pending crash reports to the server. Wire this to beforeunload at the
 * app layer, mirroring the webOS reference.
 * The store is cleared only after a confirmed export; a failed export keeps
 * the queue so it is retried on the next launch (no silent data loss).
 */
export function flushCrashReports(
  store: CrashReporterStore,
  exportFn?: (events: unknown[]) => Promise<void>
): void {
  const crashes = getPendingCrashes(store);
  if (crashes.length === 0 || !exportFn) return;
  exportFn(crashes)
    .then(() => {
      clearCrashes(store);
    })
    .catch(() => {
      // Export failed: keep the queue for the next launch.
    });
}
