/**
 * Tizen Analytics Adapter — exports events to the server.
 * Uses XMLHttpRequest for broader Tizen compat.
 */

import { buildExportBody, type AnalyticsEndpoint } from '@ctv/core';
import type { AnalyticsEvent, DeviceInfo } from '@ctv/shared/contracts/analytics';

// Bound the per-export network wait. Named so the timeout stays tunable and
// the adapter is free of magic numbers.
const ANALYTICS_EXPORT_TIMEOUT_MS = 15000;

// Tracks in-flight export requests so ONE shared unload handler can abort them
// all. A single guard (installed lazily) replaces the per-call beforeunload
// listener that accumulated over a long session and leaked closures.
const inflightExports = new Set<XMLHttpRequest>();
let unloadGuardInstalled = false;

function installUnloadGuard(): void {
  if (unloadGuardInstalled) return;
  unloadGuardInstalled = true;
  window.addEventListener(
    'beforeunload',
    () => {
      inflightExports.forEach((xhr) => {
        if (xhr.readyState < 4) xhr.abort();
      });
    },
    { once: true }
  );
}

/**
 * Create an analytics export function for Tizen.
 * Posts analytics events to the server via XMLHttpRequest. The url and the body
 * shape arrive from core (core/src/analytics/AnalyticsEndpoint.ts).
 */
export function createAnalyticsExport(
  endpoint: AnalyticsEndpoint
): (events: unknown[], deviceInfo?: DeviceInfo) => Promise<void> {
  const fullUrl = endpoint.url;

  return (events: unknown[], deviceInfo?: DeviceInfo): Promise<void> => {
    if (events.length === 0) return Promise.resolve();

    // The body is core's decision, and a v2 body that would be refused never
    // reaches the network.
    const { body, errors } = buildExportBody(endpoint, events as AnalyticsEvent[], deviceInfo);
    if (errors.length > 0) {
      return Promise.reject(new Error(`Analytics export refused: ${errors.join('; ')}`));
    }

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', fullUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = ANALYTICS_EXPORT_TIMEOUT_MS;

      // Settle guard: each callback may fire once; whichever fires first wins.
      let settled = false;
      const settle = (fn: () => void) => () => {
        if (!settled) {
          settled = true;
          inflightExports.delete(xhr);
          fn();
        }
      };

      xhr.onload = settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Analytics export failed: ${xhr.status}`));
        }
      });

      xhr.onerror = settle(() => reject(new Error('Analytics export network error')));
      xhr.ontimeout = settle(() => reject(new Error('Analytics export timeout')));

      installUnloadGuard();
      inflightExports.add(xhr);

      // A throw from send() rejects the promise; drop the request from the
      // in-flight set first so the unload guard never aborts a dead request.
      try {
        xhr.send(body);
      } catch (e) {
        inflightExports.delete(xhr);
        throw e;
      }
    });
  };
}
