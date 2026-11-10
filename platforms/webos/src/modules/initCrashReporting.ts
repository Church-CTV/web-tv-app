/**
 * Crash reporting initialization module.
 * Sets up window error handlers for uncaught exceptions and rejections.
 */

import { setupCrashReporting as setupCrashReportingAdapter } from '../Adapter/CrashReporter';

export function createCrashReporter(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  },
  exportFn: (events: unknown[]) => Promise<void>
): void {
  setupCrashReportingAdapter(storage, exportFn);
}
