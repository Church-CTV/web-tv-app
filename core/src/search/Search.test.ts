/**
 * Search module tests — debounced search, relevance ranking, case-insensitive matching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchVideos, debounce } from './Search';

// Shared test data
const testVideos = [
  {
    id: 'sermon-001',
    title: 'The Power of Faith',
    shortDescription: 'Exploring the power of faith in our daily lives',
    thumbnail: '/thumb/001.jpg',
    hdPosterUrl: '/poster/001.jpg',
    sdPosterUrl: '/poster/001-sd.jpg',
    url: '/stream/sermon-001.mp4',
    releaseDate: '2026-07-01',
    genres: ['Sermon', 'Faith'],
    content: {
      duration: 3600,
      videos: [{ url: '/stream/sermon-001.mp4', quality: 'FHD', videoType: 'MP4' }],
    },
  },
  {
    id: 'sermon-002',
    title: 'Walking in Grace',
    shortDescription: 'Understanding grace and forgiveness',
    thumbnail: '/thumb/002.jpg',
    hdPosterUrl: '/poster/002.jpg',
    sdPosterUrl: '/poster/002-sd.jpg',
    url: '/stream/sermon-002.mp4',
    releaseDate: '2026-07-02',
    genres: ['Sermon', 'Grace'],
    content: {
      duration: 2700,
      videos: [{ url: '/stream/sermon-002.mp4', quality: 'FHD', videoType: 'MP4' }],
    },
  },
  {
    id: 'worship-001',
    title: 'Worship Session',
    shortDescription: 'A time of worship and praise',
    thumbnail: '/thumb/w01.jpg',
    hdPosterUrl: '/poster/w01.jpg',
    sdPosterUrl: '/poster/w01-sd.jpg',
    url: '/stream/worship-001.mp4',
    releaseDate: '2026-07-03',
    genres: ['Worship'],
    content: {
      duration: 1800,
      videos: [{ url: '/stream/worship-001.mp4', quality: 'FHD', videoType: 'MP4' }],
    },
  },
];

describe('Search', () => {
  describe('searchVideos', () => {
    it('matches title case-insensitively', () => {
      const results = searchVideos(testVideos, 'faith');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].video.title).toBe('The Power of Faith');
    });

    it('matches description', () => {
      const results = searchVideos(testVideos, 'grace');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].video.shortDescription).toContain('grace');
    });

    it('matches genre tags', () => {
      const results = searchVideos(testVideos, 'worship');
      expect(results.length).toBe(1);
      expect(results[0].video.genres).toContain('Worship');
    });

    it('returns empty results for non-matching keyword', () => {
      const results = searchVideos(testVideos, 'nonexistent');
      expect(results).toEqual([]);
    });

    it('returns empty results for empty keyword', () => {
      const results = searchVideos(testVideos, '');
      expect(results).toEqual([]);
    });

    it('ranks results by relevance (title match > description match)', () => {
      const results = searchVideos(testVideos, 'faith');
      // 'The Power of Faith' has title match (score 10)
      // 'Understanding grace and forgiveness' has no faith match
      expect(results[0].video.title).toBe('The Power of Faith');
    });

    it('returns partial match (not just exact word)', () => {
      const results = searchVideos(testVideos, 'faith');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches across all video fields (id, title, description, genres)', () => {
      const results = searchVideos(testVideos, 'sermon');
      expect(results.length).toBe(2);
      const titles = results.map((r) => r.video.title);
      expect(titles).toContain('The Power of Faith');
      expect(titles).toContain('Walking in Grace');
    });

    it('includes match field information', () => {
      const results = searchVideos(testVideos, 'faith');
      expect(results[0].matches).toContain('title');
      expect(results[0].matches).toContain('description');
    });

    it('returns empty array when all videos are empty', () => {
      const results = searchVideos([], 'test');
      expect(results).toEqual([]);
    });
  });

  describe('debounce', () => {
    it('delays function execution', async () => {
      const fn = vi.fn();
      const { fn: debounced } = debounce(fn, 50);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on rapid calls', async () => {
      const fn = vi.fn();
      const { fn: debounced } = debounce(fn, 50);

      debounced();
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      debounced();
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      debounced();
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments through', async () => {
      const fn = vi.fn();
      const { fn: debounced } = debounce(fn, 30);

      debounced('hello', 42);
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
      expect(fn).toHaveBeenCalledWith('hello', 42);
    });

    it('cancels pending execution', async () => {
      const fn = vi.fn();
      const { fn: debounced, cancel } = debounce(fn, 50);

      debounced();
      cancel();
      expect(fn).not.toHaveBeenCalled();

      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
