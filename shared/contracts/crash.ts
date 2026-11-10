/**
 * Crash reporting contract.
 * Shared between all CTV platforms for crash capture and export.
 */

export interface CrashErrorInfo {
  id: string;
  name?: string;
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: string;
}

export type CrashFilter = 'all' | 'unreported';

export interface CrashReport {
  errors: CrashErrorInfo[];
  total: number;
  unreported: number;
}

export interface CrashClearResult {
  cleared: number;
}
