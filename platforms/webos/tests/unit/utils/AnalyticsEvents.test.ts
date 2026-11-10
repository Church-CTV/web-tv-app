/**
 * AnalyticsEvents — unit tests.
 * Tests the analytics event emission module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsEvents } from '../../../src/utils/AnalyticsEvents';

// Mock Analytics from core
const mockTrackInteraction = vi.fn();
const mockAnalytics = {
  trackInteraction: mockTrackInteraction,
} as any;

describe('AnalyticsEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the internal sessionId so tests are deterministic
    // We can't directly reset it, but we can verify behavior with fresh calls
    mockTrackInteraction.mockClear();
  });

  it('screenView calls trackInteraction with screen_view type', () => {
    analyticsEvents.screenView(mockAnalytics, 'home');
    expect(mockTrackInteraction).toHaveBeenCalledWith('screen_view', 'home', undefined);
  });

  it('screenView includes screen name as second arg', () => {
    analyticsEvents.screenView(mockAnalytics, 'schedule');
    expect(mockTrackInteraction).toHaveBeenCalledWith('screen_view', 'schedule', undefined);
  });

  it('contentSelect calls trackInteraction with content_select type', () => {
    analyticsEvents.contentSelect(mockAnalytics, 'video-001', 'Test Video', 'home');
    expect(mockTrackInteraction).toHaveBeenCalledWith('content_select', 'home', 'video-001');
  });

  it('contentPlay calls trackInteraction with content_play type', () => {
    analyticsEvents.contentPlay(mockAnalytics, 'video-002', 'Another Video');
    expect(mockTrackInteraction).toHaveBeenCalledWith('content_play', 'video', 'video-002');
  });

  it('contentPause calls trackInteraction with content_pause type', () => {
    analyticsEvents.contentPause(mockAnalytics, 'video-002');
    expect(mockTrackInteraction).toHaveBeenCalledWith('content_pause', 'video', 'video-002');
  });

  it('contentComplete calls trackInteraction with content_complete type', () => {
    analyticsEvents.contentComplete(mockAnalytics, 'video-003', 'Completed Video');
    expect(mockTrackInteraction).toHaveBeenCalledWith('content_complete', 'video', 'video-003');
  });

  it('searchStart calls trackInteraction with search_start type', () => {
    analyticsEvents.searchStart(mockAnalytics, 'action movies');
    expect(mockTrackInteraction).toHaveBeenCalledWith('search_start', 'search', 'action movies');
  });

  it('searchResultSelect calls trackInteraction with search_result_select type', () => {
    analyticsEvents.searchResultSelect(mockAnalytics, 'video-100', 'Search Result');
    expect(mockTrackInteraction).toHaveBeenCalledWith(
      'search_result_select',
      'search',
      'video-100'
    );
  });

  it('does not call trackInteraction when analytics is null', () => {
    analyticsEvents.screenView(null, 'home');
    expect(mockTrackInteraction).not.toHaveBeenCalled();

    analyticsEvents.contentSelect(null, 'video-001', 'Test', 'home');
    expect(mockTrackInteraction).not.toHaveBeenCalled();
  });

  it('does not call trackInteraction when analytics is null for all event types', () => {
    const types = [
      () => analyticsEvents.contentPlay(null, 'v1', 'T'),
      () => analyticsEvents.contentPause(null, 'v1'),
      () => analyticsEvents.contentComplete(null, 'v1', 'T'),
      () => analyticsEvents.searchStart(null, 'query'),
      () => analyticsEvents.searchResultSelect(null, 'v1', 'T'),
    ];
    for (const fn of types) {
      fn();
      expect(mockTrackInteraction).not.toHaveBeenCalled();
    }
  });
});
