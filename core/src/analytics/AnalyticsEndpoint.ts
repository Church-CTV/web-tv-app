/**
 * AnalyticsEndpoint — where telemetry goes, and in what body, decided from the
 * effective client config rather than from a host and a path baked into each
 * adapter.
 *
 * CONFIGURATION.md makes the delivered channel profile the authority for
 * `analytics.exportUrl`; the live server makes it a strict contract. Both
 * published profiles name an ABSOLUTE v2 url, and that url answers
 * `400 {"error":"invalid-event-envelope"}` to the bare event array the adapters
 * used to post (measured once, recorded in
 * shared/test-fixtures/live-2026-11-09/analytics-v2-probe.json). So the choice
 * of url and the choice of body are one decision, taken here, and the platform
 * adapters become transports that cannot disagree with it.
 *
 * Fail-closed rules, all of them the server's own:
 * - an export url outside the configured server origin is refused; telemetry
 *   stays on the origin the app was configured with (`origin-not-allowed:…`);
 * - a v2 body is certified before it is sent: missing `deviceInfo.deviceId`,
 *   an event key outside `V2_EVENT_FIELDS`, or a measurement field that is not
 *   finite and >= 0 stops the send instead of spending a 400 the retry queue
 *   would hide.
 */

import type {
  AnalyticsEnvelope,
  AnalyticsEvent,
  DeviceInfo,
} from '@ctv/shared/contracts/analytics';
import { V2_EVENT_FIELDS, V2_MEASUREMENT_FIELDS } from '@ctv/shared/contracts/analytics';

import type { ClientConfig } from '../server-config/ClientConfig';

/** Legacy route the pre-profile servers still accept (shared/contracts/server.ts). */
export const ANALYTICS_LEGACY_PATH = '/api/analytics';

/**
 * `v2` sends the envelope the profile-named route requires; `legacy` sends the
 * plain event array the legacy route has always accepted. There is no third
 * mode: a client never invents a body shape.
 */
export type AnalyticsTransportMode = 'v2' | 'legacy';

export interface AnalyticsEndpoint {
  /** Fully resolved absolute url to POST to. */
  url: string;
  envelope: AnalyticsTransportMode;
  /** Machine-readable reasons a delivered value was refused. */
  errors?: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decide the analytics endpoint from the effective config plus the base url the
 * app was launched with. The origin check runs here even when config validation
 * already ran it, because a transport that trusts an unvalidated remote value is
 * the failure mode CONFIGURATION.md names ("allowed endpoint origins ... are
 * explicit policy, not arbitrary remote overrides").
 */
export function resolveAnalyticsEndpoint(
  config: ClientConfig,
  baseUrl: string,
  allowedOrigin?: string
): AnalyticsEndpoint {
  const configuredBase = allowedOrigin ?? baseUrl;
  // The legacy route is joined onto the launch base exactly as the three
  // adapters joined it before (base without trailing slashes + path), so a
  // deployment whose base carries a path prefix keeps working and the url a
  // server has always answered on does not move under it.
  const legacyUrl = () => configuredBase.replace(/\/+$/, '') + ANALYTICS_LEGACY_PATH;

  const delivered = config.analytics?.exportUrl ?? '';
  if (delivered === '') {
    // No delivered endpoint: this is a server that never adopted the v2 route,
    // so the body stays the legacy array too.
    return { url: legacyUrl(), envelope: 'legacy' };
  }

  let parsed: URL;
  try {
    parsed = new URL(delivered);
  } catch {
    return {
      url: legacyUrl(),
      envelope: 'legacy',
      errors: [`invalid-url:analytics.exportUrl`],
    };
  }

  let allowed: URL;
  try {
    allowed = new URL(configuredBase);
  } catch {
    return {
      url: parsed.toString(),
      envelope: 'v2',
      errors: [`invalid-base-url:${configuredBase}`],
    };
  }

  if (parsed.origin !== allowed.origin) {
    return {
      url: legacyUrl(),
      envelope: 'legacy',
      errors: ['origin-not-allowed:analytics.exportUrl'],
    };
  }

  return { url: parsed.toString(), envelope: 'v2' };
}

/** Build the object the v2 route requires around an already-collected batch. */
export function buildV2ExportEnvelope(
  events: AnalyticsEvent[],
  deviceInfo: DeviceInfo
): AnalyticsEnvelope {
  return { deviceInfo, events };
}

/**
 * The one place a telemetry body is built, so no platform can quietly invent a
 * shape. `errors` is empty in `legacy` mode (that route has always taken the
 * plain array) and carries the server's own refusal reasons in `v2` mode.
 */
export function buildExportBody(
  endpoint: AnalyticsEndpoint,
  events: AnalyticsEvent[],
  deviceInfo?: DeviceInfo
): { body: string; errors: string[] } {
  if (endpoint.envelope === 'legacy') {
    return { body: JSON.stringify(events), errors: [] };
  }
  const envelope = buildV2ExportEnvelope(events, deviceInfo ?? { deviceId: '' });
  const errors = analyticsEnvelopeErrors(envelope);
  return { body: JSON.stringify(envelope), errors };
}

/**
 * Certify a body against the server's own ingestion gate before sending it.
 * Returns machine-readable reasons naming the offending path or field, in the
 * order the server would notice them.
 */
export function analyticsEnvelopeErrors(body: unknown): string[] {
  if (!isPlainObject(body)) return ['invalid-event-envelope'];

  const errors: string[] = [];
  const deviceInfo = body.deviceInfo;
  const deviceId = isPlainObject(deviceInfo) ? deviceInfo.deviceId : undefined;
  if (typeof deviceId !== 'string' || deviceId === '') errors.push('missing-deviceId');

  const rawEvents = body.events;
  if (!Array.isArray(rawEvents)) {
    errors.push('invalid-event-envelope');
    return errors;
  }

  const allowed = new Set(V2_EVENT_FIELDS);
  for (const event of rawEvents) {
    if (!isPlainObject(event)) {
      errors.push('invalid-event');
      continue;
    }
    for (const field of V2_MEASUREMENT_FIELDS) {
      const value = event[field];
      if (
        value !== undefined &&
        (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      ) {
        errors.push(`invalid-event-measurement:${field}`);
      }
    }
    const unknown = Object.keys(event)
      .filter((key) => !allowed.has(key))
      .sort();
    for (const key of unknown) errors.push(`unknown-event-field:${key}`);
  }
  return errors;
}
