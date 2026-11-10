/**
 * Analytics Engine — Core unit tests
 *
 * Tests for: EventTracker, ExportPayload, RetryQueue, DeviceManager, Analytics API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  trackScreenView,
  trackInteraction,
  trackContentPlay,
  trackPlaybackState,
  trackDeepLink,
  trackError,
  flushEvents,
  shutdown,
  getAnalyticsInstance,
  setAnalyticsInstance,
  clearAnalyticsInstance,
  createAnalyticsInstance,
} from './EventTracker';
import { buildExportPayload } from './ExportPayload';
import { RetryQueue } from './RetryQueue';
import { DeviceManager } from './DeviceManager';
import { Analytics } from './Analytics';
import type { AnalyticsEvent } from '@ctv/shared/contracts/analytics';
import {
  VALID_EVENT_TYPES,
  VALID_ACTIONS,
  VALID_PLAYBACK_STATES,
  VALID_ERROR_TYPES,
  MEMORY_CAPS,
} from '@ctv/shared/contracts/analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, val: string): void;
  removeItem(key: string): void;
  get length(): number;
  key(index: number): string | null;
}

function makeMockStorage(): MockStorage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
}

// ─── EventTracker Tests ───────────────────────────────────────────────────────

describe('EventTracker', () => {
  beforeEach(() => {
    clearAnalyticsInstance();
    createAnalyticsInstance();
    // These tests verify tracking behavior — explicitly opt in.
    getAnalyticsInstance()!.setOptOut(false);
  });

  afterEach(() => {
    clearAnalyticsInstance();
  });

  describe('TrackScreenView', () => {
    it('creates a correct screen_view event', () => {
      const tracker = getAnalyticsInstance();
      expect(tracker).toBeDefined();
      tracker!.trackScreenView('Home');
      const pending = tracker!.getPendingEvents();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('screen_view');
      const evt = pending[0] as any;
      expect(evt.screenName).toBe('Home');
      expect(typeof evt.timestamp).toBe('string');
    });

    it('includes previousScreen when provided', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackScreenView('Grid', 'Home');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.previousScreen).toBe('Home');
    });

    it('enforces memory cap of 50 screen views', () => {
      const tracker = getAnalyticsInstance()!;
      for (let i = 0; i < 55; i++) {
        tracker.trackScreenView(`Screen-${i}`);
      }
      const events = tracker
        .getPendingEvents()
        .filter((e: AnalyticsEvent) => e.eventType === 'screen_view');
      expect(events.length).toBeLessThanOrEqual(MEMORY_CAPS.screenViews);
    });
  });

  describe('TrackContentPlay', () => {
    it('creates a correct content_play event', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackContentPlay('video-1', 'Test Sermon', 3600, 'Home');
      const pending = tracker.getPendingEvents();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('content_play');
      const evt = pending[0] as any;
      expect(evt.contentId).toBe('video-1');
      expect(evt.contentTitle).toBe('Test Sermon');
      expect(evt.contentDuration).toBe(3600);
      expect(evt.sourceScreen).toBe('Home');
    });

    it('enforces memory cap of 100 plays', () => {
      const tracker = getAnalyticsInstance()!;
      for (let i = 0; i < 105; i++) {
        tracker.trackContentPlay(`video-${i}`, `Video ${i}`, 100);
      }
      const events = tracker
        .getPendingEvents()
        .filter((e: AnalyticsEvent) => e.eventType === 'content_play');
      expect(events.length).toBeLessThanOrEqual(MEMORY_CAPS.plays);
    });
  });

  describe('TrackPlaybackStateChange', () => {
    it('creates a correct playback_state event with play', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackPlaybackState('play', 'video-1');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.eventType).toBe('playback_state');
      expect(evt.state).toBe('play');
      expect(evt.contentId).toBe('video-1');
    });

    it('creates a correct playback_state event with pause', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackPlaybackState('pause', 'video-1');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.state).toBe('pause');
    });

    it('creates a correct playback_state event with resume', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackPlaybackState('resume', 'video-1');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.state).toBe('resume');
    });
  });

  describe('TrackInteraction', () => {
    it('creates a correct interaction event', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackInteraction('select', 'content-card', 'video-1');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.eventType).toBe('interaction');
      expect(evt.action).toBe('select');
      expect(evt.target).toBe('content-card');
      expect(evt.details).toBe('video-1');
    });

    it('accepts all valid actions', () => {
      const tracker = getAnalyticsInstance()!;
      for (const action of VALID_ACTIONS) {
        tracker.trackInteraction(action);
        const evt = tracker.getPendingEvents()[tracker.getPendingEvents().length - 1] as any;
        expect(evt.action).toBe(action);
      }
    });
  });

  describe('TrackDeepLink', () => {
    it('creates a correct deep_link event', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackDeepLink('video-1', 'video', 'search');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.eventType).toBe('deep_link');
      expect(evt.contentId).toBe('video-1');
      expect(evt.mediaType).toBe('video');
      expect(evt.source).toBe('search');
    });

    it('enforces memory cap of 50 deep links', () => {
      const tracker = getAnalyticsInstance()!;
      for (let i = 0; i < 55; i++) {
        tracker.trackDeepLink(`video-${i}`, 'video');
      }
      const events = tracker
        .getPendingEvents()
        .filter((e: AnalyticsEvent) => e.eventType === 'deep_link');
      expect(events.length).toBeLessThanOrEqual(MEMORY_CAPS.deepLinks);
    });
  });

  describe('TrackError', () => {
    it('creates a correct error event', () => {
      const tracker = getAnalyticsInstance()!;
      tracker.trackError('network', 'Connection timeout', 'feed_fetch');
      const evt = tracker.getPendingEvents()[0] as any;
      expect(evt.eventType).toBe('error');
      expect(evt.errorType).toBe('network');
      expect(evt.errorMessage).toBe('Connection timeout');
      expect(evt.context).toBe('feed_fetch');
    });

    it('enforces memory cap of 50 errors', () => {
      const tracker = getAnalyticsInstance()!;
      for (let i = 0; i < 55; i++) {
        tracker.trackError('network', `Error ${i}`);
      }
      const events = tracker
        .getPendingEvents()
        .filter((e: AnalyticsEvent) => e.eventType === 'error');
      expect(events.length).toBeLessThanOrEqual(MEMORY_CAPS.errors);
    });
  });

  describe('FlushEvents', () => {
    it('exports pending events and clears them', () => {
      const exportFn = vi.fn().mockResolvedValue(undefined);
      const tracker = getAnalyticsInstance()!;
      tracker.init(
        {
          exportUrl: '/analytics',
          exportIntervalSeconds: 300,
          maxEventsPerBatch: 50,
          flushOnError: true,
        },
        exportFn
      );
      tracker.trackScreenView('Home');
      tracker.trackContentPlay('video-1', 'Sermon', 3600);
      expect(tracker.getPendingEvents().length).toBe(2);
      const flushed = tracker.flushEvents();
      expect(flushed).toHaveLength(2);
      expect(tracker.getPendingEvents().length).toBe(0);
    });
  });

  describe('Shutdown', () => {
    it('flushes events with a final flush on shutdown', () => {
      const exportFn = vi.fn().mockResolvedValue(undefined);
      const tracker = getAnalyticsInstance()!;
      tracker.init(
        {
          exportUrl: '/analytics',
          exportIntervalSeconds: 300,
          maxEventsPerBatch: 50,
          flushOnError: true,
        },
        exportFn
      );
      tracker.trackScreenView('Home');
      tracker.shutdown();
      expect(tracker.getPendingEvents().length).toBe(0);
    });
  });
});

// ─── ExportPayload Tests ──────────────────────────────────────────────────────

describe('ExportPayload', () => {
  it('produces Roku-compatible nested structure', () => {
    const events: AnalyticsEvent[] = [
      { eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' },
      { eventType: 'content_play', timestamp: '2026-07-06T12:01:00Z', contentId: 'video-1' },
    ];
    const payload = buildExportPayload(events, 'v1.0.0', 'Home', '2026-07-06T12:00:00Z');
    expect(payload.appVersion).toBe('v1.0.0');
    expect(payload.activeScreen).toBe('Home');
    expect(payload.eventCount).toBe(2);
  });

  it('builds correct event summary', () => {
    const events: AnalyticsEvent[] = [
      { eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' },
      { eventType: 'screen_view', timestamp: '2026-07-06T12:01:00Z', screenName: 'Grid' },
      { eventType: 'content_play', timestamp: '2026-07-06T12:02:00Z', contentId: 'video-1' },
      {
        eventType: 'deep_link',
        timestamp: '2026-07-06T12:03:00Z',
        contentId: 'video-1',
        mediaType: 'video' as const,
        source: 'search' as const,
      },
      { eventType: 'error', timestamp: '2026-07-06T12:04:00Z', errorType: 'network' },
    ];
    const payload = buildExportPayload(events, 'v1.0.0', 'Home', '2026-07-06T12:00:00Z');
    expect(payload.summary.screenViews).toBe(2);
    expect(payload.summary.plays).toBe(1);
    expect(payload.summary.deepLinks).toBe(1);
    expect(payload.summary.errors).toBe(1);
  });

  it('groups events into correct containers', () => {
    const events: AnalyticsEvent[] = [
      { eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' },
      { eventType: 'content_play', timestamp: '2026-07-06T12:01:00Z', contentId: 'video-1' },
    ];
    const payload = buildExportPayload(events, 'v1.0.0', 'Home', '2026-07-06T12:00:00Z');
    expect(payload.events.screenViews).toHaveLength(1);
    expect(payload.events.plays).toHaveLength(1);
  });

  it('excludes empty event containers', () => {
    const events: AnalyticsEvent[] = [
      { eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' },
    ];
    const payload = buildExportPayload(events, 'v1.0.0', 'Home', '2026-07-06T12:00:00Z');
    expect(payload.events.screenViews).toBeDefined();
    expect(payload.events.plays).toBeUndefined();
    expect(payload.events.deepLinks).toBeUndefined();
    expect(payload.events.errors).toBeUndefined();
  });
});

// ─── RetryQueue Tests ─────────────────────────────────────────────────────────

describe('RetryQueue', () => {
  it('adds events to the retry queue', () => {
    const queue = new RetryQueue();
    queue.add({ eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' });
    expect(queue.size()).toBe(1);
  });

  it('retrieves and removes events from queue', () => {
    const queue = new RetryQueue();
    const event = {
      eventType: 'screen_view',
      timestamp: '2026-07-06T12:00:00Z',
      screenName: 'Home',
    };
    queue.add(event);
    const retrieved = queue.pop();
    expect(retrieved).toEqual(event);
    expect(queue.size()).toBe(0);
  });

  it('returns null when queue is empty', () => {
    const queue = new RetryQueue();
    expect(queue.pop()).toBeNull();
  });

  it('persists and recovers events (simulated)', () => {
    const mockStorage = makeMockStorage();
    const queue = new RetryQueue(mockStorage);
    const events = [
      { eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' },
    ];
    queue.add(events);
    expect(queue.size()).toBe(1);
    // Simulate persistence
    const persisted = mockStorage.getItem('ctv_analytics_retry');
    expect(persisted).not.toBeNull();
    // Create new queue from persisted state
    const recovered = new RetryQueue(mockStorage);
    expect(recovered.size()).toBe(1);
  });

  it('clears the queue on successful export', () => {
    const queue = new RetryQueue();
    queue.add({ eventType: 'screen_view', timestamp: '2026-07-06T12:00:00Z', screenName: 'Home' });
    queue.clear();
    expect(queue.size()).toBe(0);
  });

  it('supports bounded queue size', () => {
    const queue = new RetryQueue(undefined, 5);
    for (let i = 0; i < 10; i++) {
      queue.add({
        eventType: 'screen_view',
        timestamp: '2026-07-06T12:00:00Z',
        screenName: `Screen-${i}`,
      });
    }
    expect(queue.size()).toBeLessThanOrEqual(5);
  });
});

// ─── DeviceManager Tests ──────────────────────────────────────────────────────

describe('DeviceManager', () => {
  it('generates a consistent deviceId', () => {
    const dm = new DeviceManager();
    const id1 = dm.getDeviceId();
    const id2 = dm.getDeviceId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('stores deviceId in storage for persistence', () => {
    const mockStorage = makeMockStorage();
    const dm = new DeviceManager(mockStorage);
    const id = dm.getDeviceId();
    expect(mockStorage.getItem('ctv_device_id')).toBe(id);
  });

  it('includes channel name and app version in device info', () => {
    const mockStorage = makeMockStorage();
    const dm = new DeviceManager(mockStorage);
    dm.setChannelName('Test Channel');
    dm.setAppVersion('v1.0.0');
    const info = dm.getDeviceInfo();
    expect(info.deviceId).toBeDefined();
    expect(info.channelName).toBe('Test Channel');
    expect(info.appVersion).toBe('v1.0.0');
  });
});

// ─── Analytics API Tests ─────────────────────────────────────────────────────

describe('Analytics', () => {
  it('initializes with export config', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(
      {
        exportUrl: '/analytics',
        exportIntervalSeconds: 300,
        maxEventsPerBatch: 50,
        flushOnError: true,
      },
      exportFn
    );
    expect(analytics.getPendingCount()).toBe(0);
  });

  it('tracks events and increments pending count', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(
      {
        exportUrl: '/analytics',
        exportIntervalSeconds: 300,
        maxEventsPerBatch: 50,
        flushOnError: true,
      },
      exportFn
    );
    // Opt in: these tests verify tracking behavior.
    analytics.setOptOut(false);
    analytics.trackScreenView('Home');
    expect(analytics.getPendingCount()).toBe(1);
  });

  it('flushes events on export', async () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(
      {
        exportUrl: '/analytics',
        exportIntervalSeconds: 300,
        maxEventsPerBatch: 50,
        flushOnError: true,
      },
      exportFn
    );
    analytics.setOptOut(false);
    analytics.trackScreenView('Home');
    const flushed = await analytics.flush();
    expect(flushed).toHaveLength(1);
    expect(exportFn).toHaveBeenCalled();
    expect(analytics.getPendingCount()).toBe(0);
  });

  it('handles export failure with retry', async () => {
    let attempts = 0;
    const exportFn = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return Promise.resolve();
    });
    const analytics = new Analytics();
    analytics.init(
      {
        exportUrl: '/analytics',
        exportIntervalSeconds: 300,
        maxEventsPerBatch: 50,
        flushOnError: true,
        retryAttempts: 3,
        retryBaseDelayMs: 10,
      },
      exportFn
    );
    analytics.setOptOut(false);
    analytics.trackScreenView('Home');
    await analytics.flush();
    expect(attempts).toBe(3);
  });

  it('resets state on shutdown', () => {
    const exportFn = vi.fn().mockResolvedValue(undefined);
    const analytics = new Analytics();
    analytics.init(
      {
        exportUrl: '/analytics',
        exportIntervalSeconds: 300,
        maxEventsPerBatch: 50,
        flushOnError: true,
      },
      exportFn
    );
    analytics.trackScreenView('Home');
    analytics.shutdown();
    expect(analytics.getPendingCount()).toBe(0);
  });

  describe('getAnalyticsInstance (singleton)', () => {
    it('returns the same instance on repeated calls', () => {
      const a1 = getAnalyticsInstance();
      const a2 = getAnalyticsInstance();
      expect(a1).toBe(a2);
    });
  });
});
