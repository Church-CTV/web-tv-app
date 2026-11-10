/**
 * Crash Reporter module — capture and report errors.
 */

import { redactSensitive } from '../analytics/Redact';

export interface CrashReporterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface CrashReport {
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: string;
  screenName?: string;
  videoId?: string;
  appVersion?: string;
}

const CRASH_KEY = 'ctv_pending_crashes';
const MAX_CRASHES = 10;

/**
 * Capture an error and create a crash report
 */
export function captureError(
  error: Error | string,
  context?: { screenName?: string; videoId?: string }
): CrashReport {
  const rawMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
  const rawStack = typeof error === 'object' && error !== null ? (error as Error).stack : undefined;

  return {
    errorName: typeof error === 'object' && error !== null ? (error as Error).name : 'Error',
    errorMessage: redactSensitive(rawMessage) ?? rawMessage,
    stackTrace: rawStack !== undefined ? (redactSensitive(rawStack) ?? rawStack) : undefined,
    timestamp: new Date().toISOString(),
    screenName: context?.screenName,
    videoId: context?.videoId,
  };
}

/**
 * Save a crash report to local storage for later reporting
 */
export function saveCrash(store: CrashReporterStore, report: CrashReport): void {
  try {
    const crashes = getPendingCrashes(store);
    crashes.push(report);
    while (crashes.length > MAX_CRASHES) crashes.shift();
    store.set(CRASH_KEY, JSON.stringify(crashes));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Get all pending crash reports
 */
export function getPendingCrashes(store: CrashReporterStore): CrashReport[] {
  try {
    const data = store.get(CRASH_KEY);
    if (!data) return [];
    return JSON.parse(data) as CrashReport[];
  } catch {
    return [];
  }
}

/**
 * Clear pending crash reports after successful export
 */
export function clearCrashes(store: CrashReporterStore): void {
  store.remove(CRASH_KEY);
}

/**
 * Handle unhandled exception — capture and store it
 */
export function handleUnhandledError(error: Error, store: CrashReporterStore): void {
  const report = captureError(error, { screenName: 'unknown' });
  saveCrash(store, report);
}
