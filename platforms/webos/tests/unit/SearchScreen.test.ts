/**
 * SearchScreen — unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchVideos } from '@ctv/core';
import type { VideoItem } from '@ctv/core';
import {
  createSearchScreen,
  updateSearchScreen,
  focusSearchInput,
} from '../../src/ui/SearchScreen';

// Mock searchVideos to return results based on query
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual('@ctv/core');
  return {
    ...actual,
    // Mock searchVideos to return results based on query
    searchVideos: vi.fn().mockImplementation((videos, query) => {
      if (!query) return [];
      const filtered = videos.filter((v) => v.title.toLowerCase().includes(query.toLowerCase()));
      return filtered.map((v) => ({ video: v, score: 1 }));
    }),
  };
});

describe('SearchScreen', () => {
  let screen;
  let selectedVideos;

  const mockVideos = [
    {
      id: 'video-1',
      title: 'Alpha Video',
      thumbnail: 'thumb1.jpg',
      shortDescription: 'desc',
      hdPosterUrl: 'hd',
      sdPosterUrl: 'sd',
      url: 'url',
      releaseDate: '',
      genres: [],
      content: { duration: 0, videos: [{ url: 'url', quality: '', videoType: 'video' }] },
    },
    {
      id: 'video-2',
      title: 'Beta Video',
      thumbnail: 'thumb2.jpg',
      shortDescription: 'desc',
      hdPosterUrl: 'hd',
      sdPosterUrl: 'sd',
      url: 'url',
      releaseDate: '',
      genres: [],
      content: { duration: 0, videos: [{ url: 'url', quality: '', videoType: 'video' }] },
    },
    {
      id: 'video-3',
      title: 'Gamma Video',
      thumbnail: 'thumb3.jpg',
      shortDescription: 'desc',
      hdPosterUrl: 'hd',
      sdPosterUrl: 'sd',
      url: 'url',
      releaseDate: '',
      genres: [],
      content: { duration: 0, videos: [{ url: 'url', quality: '', videoType: 'video' }] },
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    selectedVideos = [];
    screen = createSearchScreen({
      videos: mockVideos,
      onVideoSelect: (videoId) => selectedVideos.push(videoId),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Cleanup to prevent timer leaks
    if (typeof screen.cleanup === 'function') {
      screen.cleanup();
    }
  });

  it('creates a screen with correct class', () => {
    expect(screen.className).toBe('search-screen');
  });

  it('renders search input', () => {
    const input = screen.querySelector('.search-screen__input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Search videos...');
    expect(input?.getAttribute('role')).toBe('searchbox');
  });

  it('renders results container', () => {
    const results = screen.querySelector('.search-screen__results');
    expect(results).toBeTruthy();
  });

  it('focuses search input on creation', () => {
    // Just verify the function doesn't throw
    expect(() => focusSearchInput(screen)).not.toThrow();
  });

  it('restores search guidance for empty query', () => {
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));

    // Advance timers past the debounce so the callback fires
    vi.advanceTimersByTime(350);

    const results = screen.querySelector('.search-screen__results');
    expect(results?.querySelector('.search-prompt')?.textContent).toContain('Find a message');
  });

  it('shows results for matching query after debounce delay', () => {
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    input.value = 'Alpha';
    input.dispatchEvent(new Event('input'));

    // Results should not appear immediately (debounce delay)
    const resultsBefore = screen.querySelector('.search-screen__results');
    const cardsBefore = resultsBefore?.querySelectorAll('.content-card');
    expect(cardsBefore?.length).toBe(0);

    // Advance timers past the 300ms debounce
    vi.advanceTimersByTime(350);

    const results = screen.querySelector('.search-screen__results');
    const cards = results?.querySelectorAll('.content-card');
    expect(cards).toBeTruthy();
    expect(cards!.length).toBeGreaterThan(0);
  });

  it('updates screen with new videos', () => {
    const newVideos = [
      {
        id: 'video-4',
        title: 'Delta Video',
        thumbnail: 'thumb4.jpg',
        shortDescription: 'desc',
        hdPosterUrl: 'hd',
        sdPosterUrl: 'sd',
        url: 'url',
        releaseDate: '',
        genres: [],
        content: { duration: 0, videos: [{ url: 'url', quality: '', videoType: 'video' }] },
      },
      {
        id: 'video-5',
        title: 'Epsilon Video',
        thumbnail: 'thumb5.jpg',
        shortDescription: 'desc',
        hdPosterUrl: 'hd',
        sdPosterUrl: 'sd',
        url: 'url',
        releaseDate: '',
        genres: [],
        content: { duration: 0, videos: [{ url: 'url', quality: '', videoType: 'video' }] },
      },
    ];

    // Set input to 'Delta' so updateSearchScreen finds matches
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    input.value = 'Delta';

    updateSearchScreen(screen, newVideos, (videoId) => selectedVideos.push(videoId));

    const results = screen.querySelector('.search-screen__results');
    const cards = results?.querySelectorAll('.content-card');
    expect(cards).toBeTruthy();
    // Only 'Delta Video' matches the 'Delta' query
    expect(cards!.length).toBe(1);
    expect(cards![0]?.textContent).toContain('Delta Video');
  });

  it('focuses search input', () => {
    // Just verify the function doesn't throw
    expect(() => focusSearchInput(screen)).not.toThrow();
  });

  it('does nothing if no input element', () => {
    const emptyScreen = document.createElement('div');
    expect(() => focusSearchInput(emptyScreen)).not.toThrow();
  });

  it('exposes a cleanup function', () => {
    expect(screen.cleanup).toBeDefined();
    expect(typeof screen.cleanup).toBe('function');
  });

  it('cleanup cancels pending timer', () => {
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    input.value = 'Alpha';
    input.dispatchEvent(new Event('input'));

    // Cleanup before timer fires
    screen.cleanup();

    // Advance timers — results should not appear
    vi.advanceTimersByTime(350);

    const results = screen.querySelector('.search-screen__results');
    const cards = results?.querySelectorAll('.content-card');
    expect(cards?.length).toBe(0);
  });

  it('cleanup can be called multiple times without error', () => {
    expect(() => screen.cleanup()).not.toThrow();
    expect(() => screen.cleanup()).not.toThrow();
  });
});
