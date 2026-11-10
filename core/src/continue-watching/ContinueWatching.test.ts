/**
 * Continue Watching tests — save/get position, partial watch detection.
 */

import { describe, it, expect } from 'vitest';
import {
  savePosition,
  getPosition,
  hasPartiallyWatched,
  getContinueWatching,
  removeFromContinueWatching,
  clearContinueWatching,
} from './ContinueWatching';

function makeMockStore() {
  const store: Record<string, string> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, val: string) => {
      store[key] = val;
    },
    remove: (key: string) => {
      delete store[key];
    },
  };
}

describe('ContinueWatching', () => {
  it('saves playback position', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Test Video', 120, 3600);
    expect(getPosition(store, 'video-1')).toBe(120);
  });

  it('returns 0 for unwatched video', () => {
    const store = makeMockStore();
    expect(getPosition(store, 'video-1')).toBe(0);
  });

  it('detects partially watched video', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Test Video', 120, 3600);
    expect(hasPartiallyWatched(store, 'video-1')).toBe(true);
  });

  it('does not mark completed video as partial', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Test Video', 3600, 3600);
    expect(hasPartiallyWatched(store, 'video-1')).toBe(false);
  });

  it('returns items sorted by last watched (newest first)', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Video 1', 100, 3600);
    const items = getContinueWatching(store);
    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('video-1');
  });

  it('removes a video from continue watching', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Test Video', 120, 3600);
    removeFromContinueWatching(store, 'video-1');
    expect(hasPartiallyWatched(store, 'video-1')).toBe(false);
  });

  it('clears all continue watching data', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Video 1', 100, 3600);
    savePosition(store, 'video-2', 'Video 2', 200, 3600);
    clearContinueWatching(store);
    expect(getPosition(store, 'video-1')).toBe(0);
    expect(getPosition(store, 'video-2')).toBe(0);
  });

  it('excludes fully watched videos from continue watching list', () => {
    const store = makeMockStore();
    savePosition(store, 'video-1', 'Video 1', 3600, 3600); // Complete
    savePosition(store, 'video-2', 'Video 2', 100, 3600); // Partial
    const items = getContinueWatching(store);
    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('video-2');
  });
});
