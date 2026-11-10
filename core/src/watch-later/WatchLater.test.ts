/**
 * Watch Later tests — add, remove, clear, check membership.
 */

import { describe, it, expect } from 'vitest';
import {
  addToWatchLater,
  removeFromWatchLater,
  isInWatchLater,
  getWatchLater,
  clearWatchLater,
  getWatchLaterCount,
} from './WatchLater';

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

describe('WatchLater', () => {
  it('adds a video to watch later', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Test Video');
    expect(getWatchLater(store)).toHaveLength(1);
    expect(getWatchLater(store)[0].videoId).toBe('video-1');
    expect(getWatchLater(store)[0].title).toBe('Test Video');
  });

  it('removes a video from watch later', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Test Video');
    removeFromWatchLater(store, 'video-1');
    expect(getWatchLater(store)).toHaveLength(0);
  });

  it('returns false for isInWatchLater when video not in queue', () => {
    const store = makeMockStore();
    expect(isInWatchLater(store, 'video-1')).toBe(false);
  });

  it('returns true for isInWatchLater when video is in queue', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Test Video');
    expect(isInWatchLater(store, 'video-1')).toBe(true);
  });

  it('does not add duplicate videos', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Test Video');
    addToWatchLater(store, 'video-1', 'Test Video');
    expect(getWatchLaterCount(store)).toBe(1);
  });

  it('clears the watch later queue', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Video 1');
    addToWatchLater(store, 'video-2', 'Video 2');
    clearWatchLater(store);
    expect(getWatchLaterCount(store)).toBe(0);
  });

  it('gets count of items in watch later', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Video 1');
    addToWatchLater(store, 'video-2', 'Video 2');
    expect(getWatchLaterCount(store)).toBe(2);
  });

  it('includes addedAt timestamp', () => {
    const store = makeMockStore();
    addToWatchLater(store, 'video-1', 'Video 1');
    expect(getWatchLater(store)[0].addedAt).toBeDefined();
  });
});
