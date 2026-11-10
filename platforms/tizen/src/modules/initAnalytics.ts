/**
 * Tizen Analytics initialization module.
 */

import { Analytics } from '@ctv/core';

export function createAnalytics(
  config: {
    exportUrl: string;
    exportIntervalSeconds: number;
    maxEventsPerBatch: number;
    flushOnError: boolean;
    retryAttempts: number;
    retryBaseDelayMs: number;
    exportTimeoutSeconds: number;
  },
  exportFn: (events: unknown[]) => Promise<void>
): Analytics {
  const analytics = new Analytics();
  analytics.init(config, exportFn);
  return analytics;
}
