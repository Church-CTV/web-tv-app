/**
 * Analytics event contracts — mirrors the server's ANALYTICS_CONTRACT.md exactly.
 * Defines the event types, schemas, and payload formats for analytics ingestion.
 */

// ─── Event Types ─────────────────────────────────────────────────────────────

export type EventType =
  'screen_view' | 'interaction' | 'content_play' | 'playback_state' | 'deep_link' | 'error';

// ─── Event Interfaces ────────────────────────────────────────────────────────

/** Base event with common fields */
export interface BaseEvent {
  eventType: EventType;
  timestamp: string; // HH:MM:SS or ISO 8601
  sessionDuration?: number; // Seconds since session start
  appVersion?: string;
}

/** Screen view event */
export interface ScreenViewEvent extends BaseEvent {
  eventType: 'screen_view';
  screenName: string;
  previousScreen?: string;
}

/** User interaction event */
export interface InteractionEvent extends BaseEvent {
  eventType: 'interaction';
  action:
    | 'select'
    | 'search'
    | 'search_result'
    | 'retry'
    | 'back'
    | 'menu'
    | 'skip_forward'
    | 'back_key'
    | 'video_error'
    | 'video_finished'
    | 'browser_open'
    | 'layout_toggle'
    | 'feature_toggle'
    | 'play'
    | 'watch_later';
  target?: string;
  details?: string;
}

/** Content play event */
export interface ContentPlayEvent extends BaseEvent {
  eventType: 'content_play';
  contentId: string;
  contentTitle?: string;
  contentDuration?: number;
  sourceScreen?: string;
}

/** Playback state change event */
export interface PlaybackStateEvent extends BaseEvent {
  eventType: 'playback_state';
  state: 'play' | 'pause' | 'resume';
  contentId?: string;
}

/** Deep link event */
export interface DeepLinkEvent extends BaseEvent {
  eventType: 'deep_link';
  contentId: string;
  mediaType: 'video' | 'series' | 'episode' | 'live' | 'movie';
  source?: 'input_launch' | 'rowlist' | 'schedule' | 'search' | 'continue' | 'watchlater';
}

/** Error event */
export interface ErrorEvent extends BaseEvent {
  eventType: 'error';
  errorType: 'network' | 'player' | 'feed' | 'ui' | 'unknown';
  errorMessage?: string;
  context?: string;
}

export type AnalyticsEvent =
  | ScreenViewEvent
  | InteractionEvent
  | ContentPlayEvent
  | PlaybackStateEvent
  | DeepLinkEvent
  | ErrorEvent;

// ─── Server-accepted field surface (measured, not assumed) ───────────────────

/**
 * The event fields the v2 ingestion route accepts. Anything outside this set is
 * answered `400 {"error":"unknown-event-field","fields":[...]}` by the server, so
 * the client has to carry the same list or a single extra key turns every flush
 * into a failure the retry queue then hides.
 *
 * Source, copied with file+line evidence into
 * shared/test-fixtures/live-2026-11-09/analytics-v2-probe.json:
 * ctv-platform-server `routes/v2.js:208-210` (refusal) and its `eventKeys` set
 * (`routes/v2.js:170-198`).
 */
export const V2_EVENT_FIELDS: readonly string[] = [
  'eventType',
  'timestamp',
  'screenName',
  'previousScreen',
  'contentId',
  'contentTitle',
  'contentDuration',
  'source',
  'state',
  'errorType',
  'errorMessage',
  'action',
  'target',
  'sessionDuration',
  'appVersion',
  'mediaType',
  'deepLinkId',
  'eventId',
  'platform',
  'sessionId',
  'details',
  'sourceScreen',
  'context',
  'timeToFirstFrame',
  'watchSeconds',
  'bufferSeconds',
  'measurementSource',
] as const;

/**
 * Numeric measurement fields the server refuses unless finite and >= 0
 * (`routes/v2.js:204-207`, `400 {"error":"invalid-event-measurement","field":...}`).
 */
export const V2_MEASUREMENT_FIELDS: readonly string[] = [
  'timeToFirstFrame',
  'watchSeconds',
  'bufferSeconds',
] as const;

/**
 * The body the v2 route requires: an OBJECT carrying `deviceInfo.deviceId` and
 * the events. A bare array is refused with `invalid-event-envelope`; that is the
 * measured answer for the body the three adapters used to send
 * (shared/test-fixtures/live-2026-11-09/analytics-v2-probe.json).
 */
export interface AnalyticsEnvelope {
  deviceInfo: DeviceInfo;
  events: AnalyticsEvent[];
}

// ─── Export Payload ──────────────────────────────────────────────────────────

/**
 * The structured export payload sent to POST /api/analytics.
 * Mirrors BuildExportPayload() output from Roku's AnalyticsExport.brs.
 */
export interface AnalyticsExportPayload {
  appVersion: string;
  sessionStartTime: string; // HH:MM:SS
  activeScreen: string;
  eventCount: number;
  summary: EventSummary;
  events: EventsContainer;
}

export interface EventSummary {
  screenViews: number;
  plays: number;
  deepLinks: number;
  errors: number;
}

export interface EventsContainer {
  screenViews?: AnalyticsEvent[];
  plays?: AnalyticsEvent[];
  deepLinks?: AnalyticsEvent[];
  errors?: AnalyticsEvent[];
}

// ─── Device Info ─────────────────────────────────────────────────────────────

export interface DeviceInfo {
  deviceId: string;
  channelName?: string;
  appVersion?: string;
}

// ─── Bounded History (memory caps — matches Roku client) ─────────────────────

export const MEMORY_CAPS = {
  screenViews: 50,
  plays: 100,
  deepLinks: 50,
  errors: 50,
} as const;

// ─── Export Config ───────────────────────────────────────────────────────────

export interface ExportConfig {
  /** URL to POST analytics to */
  exportUrl: string;
  /** Interval between periodic exports in seconds */
  exportIntervalSeconds: number;
  /** Maximum events per batch */
  maxEventsPerBatch: number;
  /** Flush on app exit regardless of batch size */
  flushOnError: boolean;
  /** Retry attempts with exponential backoff */
  retryAttempts: number;
  /** Initial retry delay in ms */
  retryBaseDelayMs: number;
  /** Export timeout in seconds */
  exportTimeoutSeconds: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Valid event type values */
export const VALID_EVENT_TYPES: EventType[] = [
  'screen_view',
  'interaction',
  'content_play',
  'playback_state',
  'deep_link',
  'error',
];

/** Valid action values for interaction events */
export const VALID_ACTIONS = [
  'select',
  'search',
  'search_result',
  'retry',
  'back',
  'menu',
  'skip_forward',
  'back_key',
  'video_error',
  'video_finished',
  'browser_open',
  'layout_toggle',
  'feature_toggle',
] as const;

/** Valid playback state values */
export const VALID_PLAYBACK_STATES: string[] = ['play', 'pause', 'resume'];

/** Valid error types */
export const VALID_ERROR_TYPES: string[] = ['network', 'player', 'feed', 'ui', 'unknown'];

/**
 * Validate an analytics event has required fields
 */
export function validateAnalyticsEvent(event: AnalyticsEvent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!VALID_EVENT_TYPES.includes(event.eventType)) {
    errors.push(`Invalid eventType: ${event.eventType}`);
  }

  if (!event.timestamp || typeof event.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp');
  }

  if (event.sessionDuration !== undefined && event.sessionDuration !== null) {
    if (typeof event.sessionDuration !== 'number' || event.sessionDuration < 0) {
      errors.push('sessionDuration must be a non-negative number');
    }
  }

  // Type-specific validation
  if (event.eventType === 'screen_view') {
    const e = event as ScreenViewEvent;
    if (!e.screenName) errors.push('screen_view requires screenName');
  }

  if (event.eventType === 'interaction') {
    const e = event as InteractionEvent;
    if (!e.action) errors.push('interaction requires action');
  }

  if (event.eventType === 'content_play') {
    const e = event as ContentPlayEvent;
    if (!e.contentId) errors.push('content_play requires contentId');
  }

  if (event.eventType === 'playback_state') {
    const e = event as PlaybackStateEvent;
    if (!VALID_PLAYBACK_STATES.includes(e.state)) {
      errors.push(`Invalid playback state: ${e.state}`);
    }
  }

  if (event.eventType === 'deep_link') {
    const e = event as DeepLinkEvent;
    if (!e.contentId) errors.push('deep_link requires contentId');
    if (!e.mediaType) errors.push('deep_link requires mediaType');
  }

  if (event.eventType === 'error') {
    const e = event as ErrorEvent;
    if (!e.errorType) errors.push('error requires errorType');
  }

  return { valid: errors.length === 0, errors };
}
