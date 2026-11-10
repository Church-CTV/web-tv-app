/**
 * AnalyticsEvents — Integration tests
 *
 * Exercises analyticsEvents against the REAL core Analytics engine (not a mock).
 * Verifies the full instrumentation pipeline:
 *   analyticsEvents → Analytics.trackInteraction → exportFn → events payload
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsEvents } from '../../../src/utils/AnalyticsEvents';
import { Analytics } from '@ctv/core';

const makeAnalytics = (exportFn?: (events: unknown[]) => Promise<void>) => {
  const analytics = new Analytics();
  analytics.init(
    {
      exportUrl: '/api/analytics',
      exportIntervalSeconds: 3600,
      maxEventsPerBatch: 100,
      flushOnError: true,
      retryAttempts: 1,
      retryBaseDelayMs: 10,
      exportTimeoutSeconds: 5,
    },
    exportFn ?? (async () => {})
  );
  // Opt in: these tests verify tracking behavior.
  analytics.setOptOut(false);
  return analytics;
};

describe('AnalyticsEventsIntegration', () => {
  beforeEach(() => {
    // Clean storage so Analytics doesn't pick up retry-queue leftovers
    localStorage.clear();
  });

  it('screenView lands as an interaction event in the core engine', () => {
    const analytics = makeAnalytics();
    analyticsEvents.screenView(analytics, 'home');
    const events = analytics.flushEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('interaction');
    expect(events[0].action).toBe('screen_view');
    expect(events[0].target).toBe('home');
  });

  it('full viewing journey produces correctly ordered interaction events', () => {
    const analytics = makeAnalytics();
    analyticsEvents.screenView(analytics, 'home');
    analyticsEvents.contentSelect(analytics, 'v-100', 'Test Title', 'home');
    analyticsEvents.contentPlay(analytics, 'v-100', 'Test Title');
    analyticsEvents.contentPause(analytics, 'v-100');
    analyticsEvents.contentComplete(analytics, 'v-100', 'Test Title');

    const events = analytics.flushEvents();
    const actions = events.map((e) => e.action as string);
    expect(actions).toEqual([
      'screen_view',
      'content_select',
      'content_play',
      'content_pause',
      'content_complete',
    ]);
    // contentId propagates as the details argument for content events
    expect(events[1].details).toBe('v-100');
    expect(events[2].details).toBe('v-100');
  });

  it('search flow emits search_start and search_result_select', () => {
    const analytics = makeAnalytics();
    analyticsEvents.searchStart(analytics, 'sci-fi');
    analyticsEvents.searchResultSelect(analytics, 'v-200', 'Found Show');
    const events = analytics.flushEvents();
    expect(events[0].action).toBe('search_start');
    expect(events[0].details).toBe('sci-fi');
    expect(events[1].action).toBe('search_result_select');
    expect(events[1].details).toBe('v-200');
  });

  it('events reach the export function with the interaction type intact', async () => {
    const exported = vi.fn(async () => {});
    const analytics = makeAnalytics(exported);
    analyticsEvents.screenView(analytics, 'home');
    analyticsEvents.contentPlay(analytics, 'v-1', 'Title');
    await analytics.flush();
    expect(exported).toHaveBeenCalledTimes(1);
    const calls = exported.mock.calls as unknown[][];
    expect(calls.length).toBe(1);
    const payload = calls[0][0] as Array<{ eventType: string; action?: string }>;
    expect(payload).toHaveLength(2);
    expect(payload.map((e) => e.action)).toEqual(['screen_view', 'content_play']);
  });

  it('does not throw when trackInteraction throws (error resilience)', () => {
    const throwingAnalytics = {
      trackInteraction: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    // Must not propagate
    expect(() => {
      analyticsEvents.screenView(
        throwingAnalytics as unknown as Parameters<typeof analyticsEvents.screenView>[0],
        'home'
      );
    }).not.toThrow();
    expect(throwingAnalytics.trackInteraction).toHaveBeenCalledTimes(1);
  });

  it('null analytics is a no-op for every event type without throwing', () => {
    const all = [
      () => analyticsEvents.screenView(null, 'home'),
      () => analyticsEvents.contentSelect(null, 'v', 'T', 'home'),
      () => analyticsEvents.contentPlay(null, 'v', 'T'),
      () => analyticsEvents.contentPause(null, 'v'),
      () => analyticsEvents.contentComplete(null, 'v', 'T'),
      () => analyticsEvents.searchStart(null, 'q'),
      () => analyticsEvents.searchResultSelect(null, 'v', 'T'),
    ];
    for (const fn of all) {
      expect(fn).not.toThrow();
    }
  });

  it('pending count stays zero when null analytics is passed', () => {
    const analytics = makeAnalytics();
    analyticsEvents.screenView(null, 'home');
    analyticsEvents.contentPlay(null, 'v', 'T');
    expect(analytics.getPendingCount()).toBe(0);
  });
});
