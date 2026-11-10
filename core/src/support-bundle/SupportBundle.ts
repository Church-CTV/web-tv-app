/**
 * Support Bundle collector — gather diagnostics while redacting sensitive data.
 * Excludes credentials, sensitive URLs, viewing history, and personal data.
 */

import { redactSensitive } from '../analytics/Redact';

export interface SupportBundleInput {
  appVersion: string;
  platform: string;
  screenName?: string;
  crashes?: Array<{
    errorName: string;
    errorMessage: string;
    stackTrace?: string;
    timestamp: string;
    screenName?: string;
    videoId?: string;
  }>;
  analytics?: Array<{
    type: string;
    screenName?: string;
    contentId?: string;
    title?: string;
    timestamp: string;
  }>;
}

export interface SupportBundle {
  metadata: {
    appVersion: string;
    platform: string;
    bundleTimestamp: string;
    redacted: boolean;
    redactionNotes: string[];
  };
  crashes: Array<{
    errorName: string;
    errorMessage: string;
    stackTrace?: string;
    timestamp: string;
    screenName?: string;
  }>;
  analytics: Array<{
    type: string;
    screenName?: string;
    title?: string;
    timestamp: string;
  }>;
}

const REDACTION_NOTES = [
  'Email addresses replaced with [REDACTED_EMAIL]',
  'URLs replaced with [REDACTED_URL]',
  'Content IDs removed from analytics events',
  'Video IDs removed from crash reports',
];

/**
 * Create a redacted support bundle from raw diagnostics data.
 */
export function createSupportBundle(input: SupportBundleInput): SupportBundle {
  // Redact crashes: remove videoId, redact messages
  const crashes = (input.crashes ?? []).map((crash) => {
    const redactedMessage = redactSensitive(crash.errorMessage) ?? crash.errorMessage;
    const redactedStack = crash.stackTrace
      ? (redactSensitive(crash.stackTrace) ?? crash.stackTrace)
      : undefined;
    return {
      errorName: crash.errorName,
      errorMessage: redactedMessage,
      stackTrace: redactedStack,
      timestamp: crash.timestamp,
      screenName: crash.screenName,
    };
  });

  // Redact analytics: remove contentId (viewing history), redact titles
  const analytics = (input.analytics ?? []).map((event) => {
    const redactedTitle = event.title ? (redactSensitive(event.title) ?? event.title) : undefined;
    return {
      type: event.type,
      screenName: event.screenName,
      title: redactedTitle,
      timestamp: event.timestamp,
    };
  });

  return {
    metadata: {
      appVersion: input.appVersion,
      platform: input.platform,
      bundleTimestamp: new Date().toISOString(),
      redacted: true,
      redactionNotes: REDACTION_NOTES,
    },
    crashes,
    analytics,
  };
}
