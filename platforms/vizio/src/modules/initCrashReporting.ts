/**
 * Tizen Crash reporting initialization module.
 */

import { setupCrashReporting } from '../Adapter/CrashReporter';

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
