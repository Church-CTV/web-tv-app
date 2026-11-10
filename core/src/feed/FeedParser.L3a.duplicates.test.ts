/**
 * FeedParser — L3a: duplicate video ID handling.
 *
 * A server feed can emit the same video id under more than one month key
 * (e.g. a re-broadcast, a generator bug, or a feed merge). The grid renders
 * one card per returned video, and the selection lookup
 * (`allVideos.find(v => v.videoId === videoId)`) resolves the FIRST match, so
 * two cards with the same id both play the first video. Deduping by id in
 * `getAllVideos` (the shared core entry point used by every platform) is the
 * fix that makes all three platforms correct at once.
 */

import { describe, it, expect } from 'vitest';
import { getAllVideos } from './FeedParser';

const baseVideo = (id: string, title: string) => ({
  id,
  title,
  shortDescription: 'desc',
  thumbnail: '/thumb.jpg',
  hdPosterUrl: '/thumb.jpg',
  sdPosterUrl: '/thumb.jpg',
  url: `/stream/${id}.mp4`,
  releaseDate: '2026-07-01',
  genres: ['Sermon'],
  content: {
    duration: 3600,
    videos: [{ url: `/stream/${id}.mp4`, quality: 'FHD', videoType: 'MP4' }],
  },
});

describe('FeedParser.getAllVideos — L3a duplicate IDs', () => {
  it('returns every video when all ids are unique (no behavior change)', () => {
    const feed: Record<string, unknown> = {
      'July 2026': [baseVideo('v1', 'One'), baseVideo('v2', 'Two')],
      'June 2026': [baseVideo('v3', 'Three')],
    };
    const videos = getAllVideos(feed);
    expect(videos).toHaveLength(3);
  });

  it('dedupes videos that share an id across month keys (keeps first/newest)', () => {
    const feed: Record<string, unknown> = {
      // Newest month first per getMonthKeys ordering.
      'July 2026': [baseVideo('v1', 'July Version')],
      'June 2026': [baseVideo('v1', 'June Version')],
    };
    const videos = getAllVideos(feed);
    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBe('v1');
    // Kept the first occurrence (newest month).
    expect(videos[0].title).toBe('July Version');
  });

  it('dedupes only the colliding id, preserving all unique ids', () => {
    const feed: Record<string, unknown> = {
      'July 2026': [baseVideo('v1', 'A'), baseVideo('v2', 'B')],
      'June 2026': [baseVideo('v1', 'dup'), baseVideo('v3', 'C')],
    };
    const videos = getAllVideos(feed);
    expect(videos).toHaveLength(3);
    const ids = videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['v1', 'v2', 'v3']);
  });

  it('keeps a single video that has no duplicate', () => {
    const feed: Record<string, unknown> = {
      'July 2026': [baseVideo('v1', 'Only')],
    };
    expect(getAllVideos(feed)).toHaveLength(1);
  });

  it('handles videos with missing/empty id without crashing (no false dedup)', () => {
    // Two videos with no id must not be collapsed into one by a naive
    // "skip empty ids" rule — they are distinct rows.
    const noId = { ...baseVideo('', ''), id: '', url: '' };
    const feed: Record<string, unknown> = {
      'July 2026': [
        { ...noId, title: 'First' },
        { ...noId, title: 'Second' },
      ],
    };
    const videos = getAllVideos(feed);
    expect(videos).toHaveLength(2);
  });
});
