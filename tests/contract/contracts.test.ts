/**
 * Contract type validation test — verifies all shared contract types compile,
 * resolve, and have the expected shape. This is the WEB-021 contract definition
 * acceptance test.
 */
import { validateAnalyticsEvent, VALID_EVENT_TYPES } from '../../shared/contracts/analytics';
import { validateFeed, getAllVideos } from '../../shared/contracts/feed';
import { SERVER_ENDPOINTS, buildUrl } from '../../shared/contracts/server';
import type { EventType, AnalyticsEvent } from '../../shared/contracts/analytics';
import type { CrashErrorInfo, CrashReport, CrashClearResult } from '../../shared/contracts/crash';
import type { Feed, VideoItem } from '../../shared/contracts/feed';
import type { HeartbeatPayload, HeartbeatResponse } from '../../shared/contracts/heartbeat';
import type {
  Schedule,
  ScheduleProgram,
  ScheduleChannel,
  ScheduleEvent,
  Reminder,
  RecordProgramResult,
} from '../../shared/contracts/schedule';
import type { ServerConfig, ServerEndpoint } from '../../shared/contracts/server';

describe('shared contracts', () => {
  describe('feed', () => {
    test('validates correct feed structure', () => {
      const feed: Feed = {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {
          showTitle: true,
          showDescription: true,
          titleFont: 'Arial',
          descriptionFont: 'Arial',
          titleColor: '#fff',
          descriptionColor: '#ccc',
          titleNumLines: 2,
          descriptionNumLines: 2,
          showDetailTitle: true,
          showDetailDescription: true,
          detailTitleFont: 'Arial',
          detailDescriptionFont: 'Arial',
          detailTitleColor: '#fff',
          detailDescriptionColor: '#ccc',
          detailTitleNumLines: 2,
          detailDescriptionNumLines: 4,
        },
        config: {
          channel: { name: 'Test', description: 'Test', language: 'en', copyright: 'Test' },
          branding: {
            colors: {
              background: '#000',
              surface: '#111',
              accent: '#f00',
              textPrimary: '#fff',
              textSecondary: '#ccc',
              focus: '#ff0',
              error: '#f00',
            },
            images: { overhangLogo: 'logo.png', backgroundImage: 'bg.png', iconFocus: 'icon.png' },
            fonts: { title: 'Arial', body: 'Arial', caption: 'Arial', heading: 'Arial' },
            spacing: { marginHorizontal: 16, marginVertical: 16 },
            animation: { cardScale: 1.05, transitionDuration: 200 },
          },
          cardStyle: {
            showTitle: true,
            showDescription: true,
            titleFont: 'Arial',
            descriptionFont: 'Arial',
            titleColor: '#fff',
            descriptionColor: '#ccc',
            titleNumLines: 2,
            descriptionNumLines: 2,
            showDetailTitle: true,
            showDetailDescription: true,
            detailTitleFont: 'Arial',
            detailDescriptionFont: 'Arial',
            detailTitleColor: '#fff',
            detailDescriptionColor: '#ccc',
            detailTitleNumLines: 2,
            detailDescriptionNumLines: 4,
          },
          features: {
            search: true,
            deepLinking: true,
            analytics: true,
            crashReporting: true,
            overhangLogo: true,
            overhangClock: true,
            overhangOptions: true,
          },
          ui: {
            backgroundColor: '#000',
            welcome: { enabled: true, title: 'Welcome', subtitle: 'Test' },
            error: { title: 'Error', message: 'Test', retryLabel: 'Retry' },
            loading: { message: 'Loading...' },
          },
          server: { baseUrl: 'https://api.example.com' },
          content: { maxRows: 10, maxItemsPerRow: 10 },
          analytics: {
            enabled: true,
            exportUrl: '/api/analytics',
            exportIntervalSeconds: 300,
            maxEventsPerBatch: 100,
            flushOnError: true,
          },
        },
      };
      const result = validateFeed(feed);
      expect(result.valid).toBe(true);
      expect(result.videoCount).toBe(0);
    });

    test('getAllVideos extracts all videos', () => {
      const feed = {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {
          showTitle: true,
          showDescription: true,
          titleFont: 'Arial',
          descriptionFont: 'Arial',
          titleColor: '#fff',
          descriptionColor: '#ccc',
          titleNumLines: 2,
          descriptionNumLines: 2,
          showDetailTitle: true,
          showDetailDescription: true,
          detailTitleFont: 'Arial',
          detailDescriptionFont: 'Arial',
          detailTitleColor: '#fff',
          detailDescriptionColor: '#ccc',
          detailTitleNumLines: 2,
          detailDescriptionNumLines: 4,
        },
        config: {
          channel: { name: 'Test', description: 'Test', language: 'en', copyright: 'Test' },
          branding: {
            colors: {
              background: '#000',
              surface: '#111',
              accent: '#f00',
              textPrimary: '#fff',
              textSecondary: '#ccc',
              focus: '#ff0',
              error: '#f00',
            },
            images: { overhangLogo: 'logo.png', backgroundImage: 'bg.png', iconFocus: 'icon.png' },
            fonts: { title: 'Arial', body: 'Arial', caption: 'Arial', heading: 'Arial' },
            spacing: { marginHorizontal: 16, marginVertical: 16 },
            animation: { cardScale: 1.05, transitionDuration: 200 },
          },
          cardStyle: {
            showTitle: true,
            showDescription: true,
            titleFont: 'Arial',
            descriptionFont: 'Arial',
            titleColor: '#fff',
            descriptionColor: '#ccc',
            titleNumLines: 2,
            descriptionNumLines: 2,
            showDetailTitle: true,
            showDetailDescription: true,
            detailTitleFont: 'Arial',
            detailDescriptionFont: 'Arial',
            detailTitleColor: '#fff',
            detailDescriptionColor: '#ccc',
            detailTitleNumLines: 2,
            detailDescriptionNumLines: 4,
          },
          features: {
            search: true,
            deepLinking: true,
            analytics: true,
            crashReporting: true,
            overhangLogo: true,
            overhangClock: true,
            overhangOptions: true,
          },
          ui: {
            backgroundColor: '#000',
            welcome: { enabled: true, title: 'Welcome', subtitle: 'Test' },
            error: { title: 'Error', message: 'Test', retryLabel: 'Retry' },
            loading: { message: 'Loading...' },
          },
          server: { baseUrl: 'https://api.example.com' },
          content: { maxRows: 10, maxItemsPerRow: 10 },
          analytics: {
            enabled: true,
            exportUrl: '/api/analytics',
            exportIntervalSeconds: 300,
            maxEventsPerBatch: 100,
            flushOnError: true,
          },
        },
        'January 2026': [
          {
            id: 'v1',
            title: 'V1',
            shortDescription: 'D1',
            thumbnail: 't.png',
            hdPosterUrl: 'h.png',
            sdPosterUrl: 's.png',
            url: '/stream/v1',
            releaseDate: '2026-01-01',
            genres: [],
            content: {
              duration: 60,
              videos: [{ url: 'v1.mp4', quality: 'FHD', videoType: 'MP4' }],
            },
          },
          {
            id: 'v2',
            title: 'V2',
            shortDescription: 'D2',
            thumbnail: 't.png',
            hdPosterUrl: 'h.png',
            sdPosterUrl: 's.png',
            url: '/stream/v2',
            releaseDate: '2026-01-02',
            genres: [],
            content: {
              duration: 60,
              videos: [{ url: 'v2.mp4', quality: 'FHD', videoType: 'MP4' }],
            },
          },
        ],
      } as Feed;
      const videos = getAllVideos(feed);
      expect(videos).toHaveLength(2);
      expect(videos[0].id).toBe('v1');
    });
  });

  describe('server', () => {
    test('has expected endpoint paths', () => {
      expect(SERVER_ENDPOINTS.feed.path).toBe('/feed');
      expect(SERVER_ENDPOINTS.stream.path).toBe('/stream/{videoName}');
      expect(SERVER_ENDPOINTS.analyticsV1.path).toBe('/api/v1/analytics');
      expect(SERVER_ENDPOINTS.heartbeat.path).toBe('/api/heartbeat');
      expect(SERVER_ENDPOINTS.schedule.path).toBe('/api/schedule');
    });

    test('buildUrl handles slashes', () => {
      expect(buildUrl('https://api.example.com/', '/feed')).toBe('https://api.example.com/feed');
      expect(buildUrl('https://api.example.com', 'feed')).toBe('https://api.example.com/feed');
    });
  });

  describe('analytics', () => {
    test('validates event types', () => {
      expect(VALID_EVENT_TYPES).toContain('screen_view');
      expect(VALID_EVENT_TYPES).toContain('interaction');
      expect(VALID_EVENT_TYPES).toContain('content_play');
      expect(VALID_EVENT_TYPES).toContain('playback_state');
      expect(VALID_EVENT_TYPES).toContain('deep_link');
      expect(VALID_EVENT_TYPES).toContain('error');
    });

    test('validates analytics event', () => {
      const event = {
        eventType: 'screen_view',
        timestamp: '2026-01-01T00:00:00Z',
        screenName: 'Home',
      } as AnalyticsEvent;
      const result = validateAnalyticsEvent(event);
      expect(result.valid).toBe(true);
    });
  });

  describe('schedule contract', () => {
    test('Schedule type has channelSchedule property', () => {
      const schedule: Schedule = {
        channelSchedule: {
          CH1: [
            {
              id: 'p1',
              title: 'Test',
              channelName: 'CH1',
              start: '10:00',
              end: '11:00',
              description: 'Test show',
            },
          ],
        },
        channelNames: { CH1: 'Channel 1' },
        channelOrder: ['CH1'],
      };
      expect(schedule.channelSchedule).toBeDefined();
      expect(schedule.channelSchedule?.['CH1']).toHaveLength(1);
      expect(schedule.channelNames?.['CH1']).toBe('Channel 1');
    });

    test('ScheduleProgram has required fields', () => {
      const program: ScheduleProgram = {
        id: 'p1',
        title: 'Test Program',
        channelName: 'Channel 1',
        start: '2026-01-01T10:00:00Z',
        end: '2026-01-01T11:00:00Z',
        description: 'A test program',
      };
      expect(program.title).toBe('Test Program');
    });
  });

  describe('crash contract', () => {
    test('CrashErrorInfo has required fields', () => {
      const error: CrashErrorInfo = {
        id: 'err-1',
        message: 'Test error',
        timestamp: '2026-01-01T00:00:00Z',
      };
      expect(error.message).toBe('Test error');
    });

    test('CrashReport has count fields', () => {
      const report: CrashReport = { errors: [], total: 5, unreported: 3 };
      expect(report.total).toBe(5);
      expect(report.unreported).toBe(3);
    });
  });

  describe('heartbeat contract', () => {
    test('HeartbeatPayload has device info fields', () => {
      const payload: HeartbeatPayload = {
        deviceId: 'dev-1',
        channelName: 'Test',
        appVersion: '1.0.0',
        os: 'webOS',
        build: '123',
        model: 'LG55',
        locale: 'en-US',
      };
      expect(payload.deviceId).toBe('dev-1');
    });

    test('HeartbeatResponse has ok and serverTime', () => {
      const response: HeartbeatResponse = { ok: true, serverTime: '2026-01-01T00:00:00Z' };
      expect(response.ok).toBe(true);
    });
  });
});
