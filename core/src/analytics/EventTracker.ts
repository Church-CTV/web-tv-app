/**
 * EventTracker — collects and manages analytics events.
 * Provides a public API for tracking screen views, plays, interactions, etc.
 * Events are batched and exported via a callback.
 *
 * This module uses a singleton pattern — call getAnalyticsInstance() to access it.
 */

import { Analytics } from './Analytics';
import type {
  AnalyticsEvent,
  DeepLinkEvent,
  ErrorEvent,
  InteractionEvent,
} from '@ctv/shared/contracts/analytics';

/** Get the singleton Analytics instance */
export function getAnalyticsInstance(): Analytics | null {
  return _instance;
}

/** Set the singleton Analytics instance (for testing) */
export function setAnalyticsInstance(analytics: Analytics): void {
  _instance = analytics;
}

/** Clear the singleton Analytics instance (for testing) */
export function clearAnalyticsInstance(): void {
  _instance = null;
}

/** Create and register a new Analytics instance */
export function createAnalyticsInstance(): Analytics {
  const analytics = new Analytics();
  _instance = analytics;
  return analytics;
}

let _instance: Analytics | null = null;

/**
 * Track a screen view event
 */
export function trackScreenView(screenName: string, previousScreen?: string): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackScreenView(screenName, previousScreen);
}

/**
 * Track a user interaction event
 */
export function trackInteraction(
  action: InteractionEvent['action'],
  target?: string,
  details?: string
): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackInteraction(action, target, details);
}

/**
 * Track a content play event
 */
export function trackContentPlay(
  contentId: string,
  contentTitle?: string,
  contentDuration?: number,
  sourceScreen?: string
): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackContentPlay(contentId, contentTitle, contentDuration, sourceScreen);
}

/**
 * Track a playback state change event
 */
export function trackPlaybackState(state: 'play' | 'pause' | 'resume', contentId?: string): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackPlaybackState(state, contentId);
}

/**
 * Track a deep link event
 */
export function trackDeepLink(
  contentId: string,
  mediaType: DeepLinkEvent['mediaType'],
  source?: DeepLinkEvent['source']
): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackDeepLink(contentId, mediaType, source);
}

/**
 * Track an error event
 */
export function trackError(
  errorType: ErrorEvent['errorType'],
  errorMessage?: string,
  context?: string
): void {
  const instance = _instance;
  if (!instance) return;
  instance.trackError(errorType, errorMessage, context);
}

/** Flush all pending events (returns them for export) */
export function flushEvents(): AnalyticsEvent[] {
  const instance = _instance;
  if (!instance) return [];
  return instance.flushEvents();
}

/** Shutdown — flushes remaining events */
export function shutdown(): void {
  const instance = _instance;
  if (!instance) return;
  instance.shutdown();
}
