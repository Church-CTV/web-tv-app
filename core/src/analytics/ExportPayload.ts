/**
 * ExportPayload — builds the structured export payload sent to POST /api/analytics.
 * Mirrors BuildExportPayload() from Roku's AnalyticsExport.brs.
 */

import type {
  AnalyticsEvent,
  AnalyticsExportPayload,
  EventSummary,
  EventsContainer,
} from '@ctv/shared/contracts/analytics';

export type { AnalyticsExportPayload };

/**
 * Build the export payload from a list of pending events.
 * Groups events by type into containers (screenViews, plays, deepLinks, errors).
 */
export function buildExportPayload(
  events: AnalyticsEvent[],
  appVersion: string,
  activeScreen: string,
  sessionStartTime: string
): AnalyticsExportPayload {
  const summary: EventSummary = {
    screenViews: 0,
    plays: 0,
    deepLinks: 0,
    errors: 0,
  };

  const containers: EventsContainer = {};

  for (const event of events) {
    // Increment summary counts
    switch (event.eventType) {
      case 'screen_view':
        summary.screenViews++;
        if (!containers.screenViews) containers.screenViews = [];
        containers.screenViews.push(event);
        break;
      case 'content_play':
        summary.plays++;
        if (!containers.plays) containers.plays = [];
        containers.plays.push(event);
        break;
      case 'deep_link':
        summary.deepLinks++;
        if (!containers.deepLinks) containers.deepLinks = [];
        containers.deepLinks.push(event);
        break;
      case 'error':
        summary.errors++;
        if (!containers.errors) containers.errors = [];
        containers.errors.push(event);
        break;
      case 'playback_state':
      case 'interaction':
        // These are counted in eventCount but not in summary containers
        break;
    }
  }

  return {
    appVersion,
    sessionStartTime,
    activeScreen,
    eventCount: events.length,
    summary,
    events: containers,
  };
}
