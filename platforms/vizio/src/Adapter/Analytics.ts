/**
 * Vizio Analytics Adapter — exports events to the server via XMLHttpRequest.
 * The url and the body shape arrive from core
 * (core/src/analytics/AnalyticsEndpoint.ts), so all three platforms speak the
 * same ingestion contract.
 */

import { buildExportBody, type AnalyticsEndpoint } from '@ctv/core';
import type { AnalyticsEvent, DeviceInfo } from '@ctv/shared/contracts/analytics';

/**
 * Create an analytics export function for Vizio.
 * Posts analytics events to the server via XMLHttpRequest.
 */
export function createAnalyticsExport(
  endpoint: AnalyticsEndpoint
): (events: unknown[], deviceInfo?: DeviceInfo) => Promise<void> {
  const fullUrl = endpoint.url;

  return async (events: unknown[], deviceInfo?: DeviceInfo): Promise<void> => {
    if (events.length === 0) return;

    // Transport only: core decides the url and whether this body may be sent.
    const { body, errors } = buildExportBody(endpoint, events as AnalyticsEvent[], deviceInfo);
    if (errors.length > 0) {
      throw new Error(`Analytics export refused: ${errors.join('; ')}`);
    }

    return new Promise<void>((resolve, reject) => {
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
