/**
 * Analytics initialization module.
 * Creates and initializes the Analytics engine with the platform export function.
 */

import { Analytics } from '@ctv/core';

export interface AnalyticsConfig {
  exportUrl: string;
  exportIntervalSeconds: number;
  maxEventsPerBatch: number;
  flushOnError: boolean;
  retryAttempts: number;
  retryBaseDelayMs: number;
  exportTimeoutSeconds: number;
}

export function createAnalytics(
  config: AnalyticsConfig,
  exportFn: (events: unknown[]) => Promise<void>
): Analytics {
  const analytics = new Analytics();
  analytics.init(config, exportFn);
  return analytics;
}
