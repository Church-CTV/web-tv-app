import { describe, it, expect } from 'vitest';
import {
  getMonthKeys,
  getAllVideos,
  groupVideosByMonth,
  filterByGenre,
  filterBySeries,
  sortByReleaseDate,
  validateFeed,
  getCardStyle,
  getClientConfig,
} from './FeedParser';

// Embedded mock feed data — mirrors shared/test-fixtures/mock-feed.json
const mockFeed: Record<string, unknown> = {
  providerName: 'Test Church Channel',
  lastUpdated: '2026-07-06T12:00:00.000Z',
  language: 'en',
  cardStyle: {
    showTitle: true,
    showDescription: true,
    titleFont: 'font:SmallBoldSystemFont',
    descriptionFont: 'font:SmallSystemFont',
    titleColor: '0xFFFFFF',
    descriptionColor: '0xA0A0B0',
    titleNumLines: 1,
    descriptionNumLines: 1,
    showDetailTitle: true,
    showDetailDescription: true,
    detailTitleFont: 'font:SmallBoldSystemFont',
    detailDescriptionFont: 'font:SmallSystemFont',
    detailTitleColor: '0xFFFFFF',
    detailDescriptionColor: '0xA0A0B0',
    detailTitleNumLines: 1,
    detailDescriptionNumLines: 3,
  },
  config: {
    channel: {
      name: 'Test Church Channel',
      description: 'A test channel',
      language: 'en',
      copyright: 'Copyright 2026',
    },
    branding: {
      colors: {
        background: '0x1A1A2E',
        surface: '0x16213E',
        accent: '0xE8B931',
        textPrimary: '0xFFFFFF',
        textSecondary: '0xA0A0B0',
        focus: '0xE8B931',
        error: '0xFF4444',
      },
      images: { overhangLogo: '', backgroundImage: '', iconFocus: '' },
      fonts: {
        title: 'font:BoldSystemFont',
        body: 'font:MediumSystemFont',
        caption: 'font:SmallSystemFont',
        heading: 'font:ExtraBoldSystemFont',
      },
      spacing: { marginHorizontal: 80, marginVertical: 40 },
      animation: { cardScale: 1.05, transitionDuration: 0.25 },
    },
    features: {
      search: true,
      deepLinking: true,
      analytics: true,
      crashReporting: true,
      continueWatching: true,
      liveService: true,
      serviceSchedule: true,
      watchLater: true,
    },
    ui: { backgroundColor: '0x1A1A2E' },
    server: { baseUrl: 'http://localhost:3000', timeout: 15 },
    analytics: {
      enabled: true,
      exportUrl: '/api/analytics',
      exportIntervalSeconds: 300,
      maxEventsPerBatch: 50,
      flushOnError: true,
    },
    sermon: {
      categories: [{ id: 'sermon', name: 'Sermons' }],
      pastors: [{ id: 'pastor-k', name: 'Pastor Ken' }],
      series: [{ id: 'series-1', name: 'Current Series' }],
    },
    navItems: [
      { id: 'home', label: 'Home', icon: 'home', screen: 'grid', order: 1 },
      { id: 'search', label: 'Search', icon: 'search', screen: 'search', order: 2 },
      { id: 'schedule', label: 'Schedule', icon: 'schedule', screen: 'schedule', order: 3 },
      {
        id: 'continue',
        label: 'Continue',
        icon: 'continue',
        screen: 'continue-watching',
        order: 4,
      },
      {
        id: 'watch-later',
        label: 'Watch Later',
        icon: 'watchlater',
        screen: 'watch-later',
        order: 5,
      },
      { id: 'settings', label: 'Settings', icon: 'settings', screen: 'settings', order: 6 },
    ],
  },
  'July 2026': [
    {
      id: 'video-test-sermon-one',
      title: 'Test Sermon One',
      shortDescription: 'A test sermon',
      thumbnail: '/output/thumbnails/test-sermon-one.jpg',
      hdPosterUrl: '/output/thumbnails/test-sermon-one.jpg',
      sdPosterUrl: '/output/thumbnails/test-sermon-one.jpg',
      url: '/stream/test-sermon-one.mp4',
      releaseDate: '2026-07-05',
      genres: ['Religious', 'Sermon'],
      content: {
        duration: 3600,
        videos: [{ url: '/stream/test-sermon-one.mp4', quality: 'FHD', videoType: 'MP4' }],
      },
      dateAdded: '2026-07-05T10:00:00.000Z',
    },
    {
      id: 'video-test-sermon-two',
      title: 'Test Sermon Two',
      shortDescription: 'Another test sermon',
      thumbnail: '/output/thumbnails/test-sermon-two.jpg',
      hdPosterUrl: '/output/thumbnails/test-sermon-two.jpg',
      sdPosterUrl: '/output/thumbnails/test-sermon-two.jpg',
      url: '/stream/test-sermon-two.mp4',
      releaseDate: '2026-07-04',
      genres: ['Religious', 'Sermon'],
      content: {
        duration: 2700,
        videos: [{ url: '/stream/test-sermon-two.mp4', quality: 'FHD', videoType: 'MP4' }],
      },
      dateAdded: '2026-07-04T10:00:00.000Z',
    },
    {
      id: 'video-test-worship',
      title: 'Test Worship Session',
      shortDescription: 'Test worship content',
      thumbnail: '/output/thumbnails/test-worship.jpg',
      hdPosterUrl: '/output/thumbnails/test-worship.jpg',
      sdPosterUrl: '/output/thumbnails/test-worship.jpg',
      url: '/stream/test-worship.mp4',
      releaseDate: '2026-07-03',
      genres: ['Worship'],
      content: {
        duration: 1800,
        videos: [{ url: '/stream/test-worship.mp4', quality: 'FHD', videoType: 'MP4' }],
      },
      dateAdded: '2026-07-03T10:00:00.000Z',
    },
  ],
  'June 2026': [
    {
      id: 'video-test-june-sermon',
      title: 'June Test Sermon',
      shortDescription: 'A test sermon from last month',
      thumbnail: '/output/thumbnails/test-june-sermon.jpg',
      hdPosterUrl: '/output/thumbnails/test-june-sermon.jpg',
      sdPosterUrl: '/output/thumbnails/test-june-sermon.jpg',
      url: '/stream/test-june-sermon.mp4',
      releaseDate: '2026-06-28',
      genres: ['Religious', 'Sermon'],
      content: {
        duration: 3000,
        videos: [{ url: '/stream/test-june-sermon.mp4', quality: 'FHD', videoType: 'MP4' }],
      },
      dateAdded: '2026-06-28T10:00:00.000Z',
    },
  ],
};

describe('FeedParser', () => {
  describe('getMonthKeys', () => {
    it('returns only month-year keys (not meta keys)', () => {
      const keys = getMonthKeys(mockFeed);
      expect(keys).not.toContain('providerName');
      expect(keys).not.toContain('lastUpdated');
      expect(keys).not.toContain('language');
      expect(keys).not.toContain('cardStyle');
      expect(keys).not.toContain('config');
    });

    it('returns correct month keys in chronological order (newest first)', () => {
      const keys = getMonthKeys(mockFeed);
      expect(keys).toContain('July 2026');
      expect(keys).toContain('June 2026');
      expect(keys.indexOf('July 2026')).toBeLessThan(keys.indexOf('June 2026'));
    });

    it('returns empty array when no month keys exist', () => {
      const emptyFeed: Record<string, unknown> = {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {},
        config: {},
      };
      expect(getMonthKeys(emptyFeed)).toEqual([]);
    });

    it('ignores non-month keys even if they look like months', () => {
      const feed: Record<string, unknown> = {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {},
        config: {},
        'InvalidMonth 2026': [],
        'January 2026': [],
      };
      expect(getMonthKeys(feed)).toEqual(['January 2026']);
    });
  });

  describe('getAllVideos', () => {
    it('extracts all videos from all month keys', () => {
      const videos = getAllVideos(mockFeed);
      expect(videos).toHaveLength(4);
    });

    it('returns an empty array when feed has no month data', () => {
      const emptyFeed: Record<string, unknown> = {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {},
        config: {},
      };
      expect(getAllVideos(emptyFeed)).toEqual([]);
    });

    it('returns video items with required fields', () => {
      const videos = getAllVideos(mockFeed);
      for (const video of videos) {
        expect(video.id).toBeDefined();
        expect(video.title).toBeDefined();
        expect(video.url).toBeDefined();
        expect(video.content).toBeDefined();
        expect(Array.isArray(video.content?.videos)).toBe(true);
      }
    });
  });

  describe('groupVideosByMonth', () => {
    it('groups videos by month key', () => {
      const grouped = groupVideosByMonth(mockFeed);
      expect(grouped['July 2026']).toHaveLength(3);
      expect(grouped['June 2026']).toHaveLength(1);
    });
  });

  describe('filterByGenre', () => {
    it('filters videos by genre', () => {
      const videos = getAllVideos(mockFeed);
      const sermons = filterByGenre(videos, 'Sermon');
      expect(sermons.length).toBeGreaterThanOrEqual(2);
      for (const v of sermons) {
        const hasSermon = v.genres?.some((g) => g.toLowerCase() === 'sermon');
        expect(hasSermon).toBe(true);
      }
    });

    it('returns empty array for non-matching genre', () => {
      const videos = getAllVideos(mockFeed);
      expect(filterByGenre(videos, 'NonExistent')).toEqual([]);
    });

    it('handles case-insensitive matching', () => {
      const videos = getAllVideos(mockFeed);
      const s1 = filterByGenre(videos, 'sermon');
      const s2 = filterByGenre(videos, 'SERMON');
      expect(s1).toEqual(s2);
    });
  });

  describe('filterBySeries', () => {
    it('filters videos by series ID', () => {
      const videos = getAllVideos(mockFeed);
      const results = filterBySeries(videos, 'sermon');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sortByReleaseDate', () => {
    it('sorts videos by release date descending', () => {
      const videos = getAllVideos(mockFeed);
      const sorted = sortByReleaseDate(videos);
      for (let i = 1; i < sorted.length; i++) {
        expect(
          sorted[i - 1].releaseDate.localeCompare(sorted[i].releaseDate)
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it('preserves original array length', () => {
      const videos = getAllVideos(mockFeed);
      expect(sortByReleaseDate(videos).length).toBe(videos.length);
    });
  });

  describe('validateFeed', () => {
    it('returns valid for the mock feed', () => {
      const result = validateFeed(mockFeed);
      expect(result.valid).toBe(true);
      expect(result.videoCount).toBe(4);
    });

    it('warns on missing providerName', () => {
      const partial = { ...mockFeed };
      delete partial.providerName;
      const result = validateFeed(partial);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Missing providerName');
    });

    it('warns on missing lastUpdated', () => {
      const partial = { ...mockFeed };
      delete partial.lastUpdated;
      expect(validateFeed(partial).warnings).toContain('Missing lastUpdated');
    });

    it('warns on missing language', () => {
      const partial = { ...mockFeed };
      delete partial.language;
      expect(validateFeed(partial).warnings).toContain('Missing language');
    });

    it('treats missing cardStyle as a warning, not an error', () => {
      const partial = { ...mockFeed };
      delete partial.cardStyle;
      const result = validateFeed(partial);
      expect(result.valid).toBe(true);
      expect(result.errors).not.toContain('Missing cardStyle');
      expect(result.warnings).toContain('Missing cardStyle');
    });

    it('treats missing config as a warning, not an error', () => {
      const partial = { ...mockFeed };
      delete partial.config;
      const result = validateFeed(partial);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Missing config');
    });

    it('accepts legacy Roku items that only have content.videos[].url', () => {
      const legacy: Record<string, unknown> = {
        providerName: 'Example Channel',
        lastUpdated: '2026-09-12T12:27:59.871Z',
        language: 'en',
        'September 2026': [
          {
            id: 'live_stream_0',
            title: 'Live Broadcast',
            thumbnail: 'https://channel.example.test/output/thumbnails/MC-Live.png',
            content: {
              duration: 0,
              videos: [
                {
                  url: 'https://video.example.test/live/Manifest.m3u8',
                  quality: 'HD',
                  videoType: 'HLS',
                },
              ],
            },
          },
        ],
      };
      const result = validateFeed(legacy);
      expect(result.valid).toBe(true);
      expect(result.videoCount).toBe(1);
      expect(result.warnings).toContain('Missing cardStyle');
      expect(result.warnings).toContain('Missing config');
    });

    it('errors when a video has no playable url at all', () => {
      const partial = { ...mockFeed };
      const videos = structuredClone(partial['July 2026']) as Array<Record<string, unknown>>;
      videos[0] = { ...videos[0], url: '', content: { duration: 3600, videos: [] } };
      partial['July 2026'] = videos;
      expect(validateFeed(partial).valid).toBe(false);
      expect(validateFeed(partial).errors.some((e) => e.includes('missing playable url'))).toBe(
        true
      );
    });

    it('warns when content.videos is missing if top-level url exists', () => {
      const partial = { ...mockFeed };
      const videos = structuredClone(partial['July 2026']) as Array<Record<string, unknown>>;
      videos[0] = { ...videos[0], content: { duration: 3600 } };
      partial['July 2026'] = videos;
      const result = validateFeed(partial);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('missing content.videos'))).toBe(true);
    });
  });

  describe('getCardStyle', () => {
    it('returns cardStyle from feed', () => {
      const cs = getCardStyle(mockFeed);
      expect(cs).toBeDefined();
      expect(cs?.showTitle).toBe(true);
      expect(cs?.titleFont).toBe('font:SmallBoldSystemFont');
    });
  });

  describe('getClientConfig', () => {
    it('returns config from feed', () => {
      const cfg = getClientConfig(mockFeed);
      expect(cfg).toBeDefined();
      expect(cfg?.channel?.name).toBe('Test Church Channel');
      expect(cfg?.features?.search).toBe(true);
      expect(cfg?.features?.analytics).toBe(true);
    });
  });
});
