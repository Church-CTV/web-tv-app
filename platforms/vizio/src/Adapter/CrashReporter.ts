/**
 * Tizen CrashReporter Adapter — captures unhandled exceptions and reports to server.
 */

interface CrashReporterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Create a crash reporter for Tizen.
 * Captures window.onerror, unhandledrejection, and Tizen-specific errors.
 */
export function createCrashReporter(
  store: CrashReporterStore,
  exportFn: (reports: unknown[]) => void
): { reportError(error: Error): void; flush(): void } {
  const reports: Array<{ timestamp: string; error: string; stack?: string; context?: string }> = [];

  // Capture unhandled errors
  window.onerror = (msg, url, line, col, error) => {
    reports.push({
      timestamp: new Date().toISOString(),
      error: String(msg),
      stack: error?.stack,
      context: `${url}:${line}:${col}`,
    });
    return true;
  };

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    reports.push({
      timestamp: new Date().toISOString(),
      error: e.reason?.message || String(e.reason),
      stack: e.reason?.stack,
    });
  });

  return {
    reportError(error: Error): void {
      reports.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
      });
    },
    flush(): void {
      if (!reports.length) return;
      exportFn(reports);
      const saved = store.get('ctv_crash_reports') || '[]';
      const all = JSON.parse(saved) as typeof reports;
      all.push(...reports);
      store.set('ctv_crash_reports', JSON.stringify(all));
      reports.length = 0;
    },
  };
}

/**
 * Set up crash reporting on Tizen.
 * This is the main entry point used by App.ts
 */
export function setupCrashReporting(
  store: CrashReporterStore,
  exportFn: (reports: unknown[]) => void
): void {
  // Just call createCrashReporter and discard the return value
  // The side effects (window.onerror, unhandledrejection) are set up
  createCrashReporter(store, exportFn);
}
