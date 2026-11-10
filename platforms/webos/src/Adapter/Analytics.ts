/**
 * WebOS Analytics Adapter — exports events to the server via XMLHttpRequest.
 * Wraps the core Analytics module's export callback.
 *
 * This is a transport only: the url, the body shape and the go/no-go on a v2
 * envelope all come from core (core/src/analytics/AnalyticsEndpoint.ts), so the
 * three platforms cannot disagree about what the server's route accepts.
 */

import { buildExportBody, type AnalyticsEndpoint } from '@ctv/core';
import type { AnalyticsEvent, DeviceInfo } from '@ctv/shared/contracts/analytics';

/**
 * Create an analytics export function for webOS.
 * Uses XMLHttpRequest (not fetch) for broader webOS compatibility.
 */
export function createAnalyticsExport(
  endpoint: AnalyticsEndpoint
): (events: unknown[], deviceInfo?: DeviceInfo) => Promise<void> {
  const fullUrl = endpoint.url;

  return async (events: unknown[], deviceInfo?: DeviceInfo): Promise<void> => {
    if (events.length === 0) return;

    const { body, errors } = buildExportBody(endpoint, events as AnalyticsEvent[], deviceInfo);
    if (errors.length > 0) {
      // Refused locally, before the network: the same reasons the route would
      // answer with, so a bad body is visible instead of queued and retried.
      throw new Error(`Analytics export refused: ${errors.join('; ')}`);
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', fullUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 15000;

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Analytics export failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Analytics export network error'));
      xhr.ontimeout = () => reject(new Error('Analytics export timeout'));

      xhr.send(body);
    });
  };
}
