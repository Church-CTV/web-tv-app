/**
 * Analytics event instrumentation — emits events for critical user actions.
 * Each event includes: screen name, content ID, timestamp, session ID.
 */

import type { Analytics } from '@ctv/core';

interface AnalyticsEvent {
  type: string;
  screen: string;
  contentId?: string;
  title?: string;
  timestamp: number;
  sessionId: string;
}

let sessionId: string;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
}

function emitEvent(analytics: Analytics | null, event: AnalyticsEvent): void {
  if (!analytics) return;
  try {
    analytics.trackInteraction(event.type, event.screen, event.contentId || event.title);
  } catch {
    // Silently ignore analytics errors — they don't break the app
  }
}

export const analyticsEvents = {
  screenView: (analytics: Analytics | null, screen: string): void => {
    emitEvent(analytics, {
      type: 'screen_view',
      screen,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  contentSelect: (
    analytics: Analytics | null,
    contentId: string,
    title: string,
    screen: string
  ): void => {
    emitEvent(analytics, {
      type: 'content_select',
      screen,
      contentId,
      title,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  contentPlay: (analytics: Analytics | null, contentId: string, title: string): void => {
    emitEvent(analytics, {
      type: 'content_play',
      screen: 'video',
      contentId,
      title,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  contentPause: (analytics: Analytics | null, contentId: string): void => {
    emitEvent(analytics, {
      type: 'content_pause',
      screen: 'video',
      contentId,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  contentComplete: (analytics: Analytics | null, contentId: string, title: string): void => {
    emitEvent(analytics, {
      type: 'content_complete',
      screen: 'video',
      contentId,
      title,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  searchStart: (analytics: Analytics | null, query: string): void => {
    emitEvent(analytics, {
      type: 'search_start',
      screen: 'search',
      contentId: query,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },

  searchResultSelect: (analytics: Analytics | null, contentId: string, title: string): void => {
    emitEvent(analytics, {
      type: 'search_result_select',
      screen: 'search',
      contentId,
      title,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
  },
};
