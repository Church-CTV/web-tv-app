/**
 * Tizen Crash reporting initialization module.
 *
 * Delegates to the adapter's setupCrashReporting (window.onerror + a single
 * unhandledrejection listener, redacted, bounded queue). Also re-exports
 * flushCrashReports so the app layer can wire a beforeunload flush — the same
 * shutdown wiring the webOS reference uses.
 */

import { setupCrashReporting, flushCrashReports } from '../Adapter/CrashReporter';

export { flushCrashReports };

export function createCrashReporter(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  },
  exportFn: (events: unknown[]) => Promise<void>
): void {
  setupCrashReporting(storage, exportFn);
}
