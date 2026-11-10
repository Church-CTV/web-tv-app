/**
 * screenLoader.ts — unit tests (Vizio).
 *
 * Tests that each dynamic-import loader in screenLoader.ts is a function
 * that returns a Promise and delegates to the underlying screen module.
 * This is the code-split boundary — a regression here silently bundles
 * everything again.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all screen modules dynamically imported by screenLoader.ts.
vi.mock('../../../src/screens/HomeScreen', () => ({
  loadMainView: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/ScheduleScreen', () => ({
  loadScheduleScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/ContinueWatchingScreen', () => ({
  loadContinueWatchingScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/WatchLaterScreen', () => ({
  loadWatchLaterScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/SettingsScreen', () => ({
  loadSettingsScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/SearchScreen', () => ({
  loadSearchScreen: vi.fn(() => Promise.resolve()),
}));

const storage = {
  get: () => null,
  set: () => {},
  remove: () => {},
  getAll: () => ({}),
};

const actions = {
  onVideoSelect: vi.fn(),
  onSearch: vi.fn(),
  onSchedule: vi.fn(),
  onContinueWatching: vi.fn(),
  onWatchLater: vi.fn(),
  onSettings: vi.fn(),
  onRetry: vi.fn(),
  onFeedLoaded: vi.fn(),
};

describe('Vizio screenLoader (code-split boundary)', () => {
  let loader: typeof import('../../../src/screenLoader');

  beforeEach(async () => {
    vi.clearAllMocks();
    loader = await import('../../../src/screenLoader');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports loadMainView as a function', () => {
    expect(typeof loader.loadMainView).toBe('function');
  });

  it('loadMainView returns a Promise and delegates to HomeScreen.loadMainView', async () => {
    const result = loader.loadMainView(storage, { trackInteraction: vi.fn() }, actions);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const homeScreen = await import('../../../src/screens/HomeScreen');
    expect(homeScreen.loadMainView).toHaveBeenCalledTimes(1);
    expect(homeScreen.loadMainView).toHaveBeenCalledWith(
      storage,
      expect.objectContaining({ trackInteraction: expect.any(Function) }),
      actions
    );
  });

  it('loadMainView propagates a rejecting Promise from the implementation', async () => {
    const homeScreen = await import('../../../src/screens/HomeScreen');
    vi.mocked(homeScreen.loadMainView).mockRejectedValueOnce(new Error('chunk failed'));
    await expect(loader.loadMainView(storage, null, actions)).rejects.toThrow('chunk failed');
  });

  it('exports loadScheduleScreen as a function and delegates', async () => {
    const result = loader.loadScheduleScreen(storage, { onPlay: vi.fn() });
    expect(result).toBeInstanceOf(Promise);
    await result;

    const schedule = await import('../../../src/screens/ScheduleScreen');
    expect(schedule.loadScheduleScreen).toHaveBeenCalledTimes(1);
  });

  it('exports loadContinueWatchingScreen as a function and delegates', async () => {
    const player = { play: vi.fn() };
    const result = loader.loadContinueWatchingScreen(storage, player);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const cw = await import('../../../src/screens/ContinueWatchingScreen');
    expect(cw.loadContinueWatchingScreen).toHaveBeenCalledTimes(1);
    expect(cw.loadContinueWatchingScreen).toHaveBeenCalledWith(storage, player);
  });

  it('exports loadWatchLaterScreen as a function and delegates', async () => {
    const result = loader.loadWatchLaterScreen(storage);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const wl = await import('../../../src/screens/WatchLaterScreen');
    expect(wl.loadWatchLaterScreen).toHaveBeenCalledTimes(1);
    expect(wl.loadWatchLaterScreen).toHaveBeenCalledWith(storage);
  });

  it('exports loadSettingsScreen as a function and delegates', async () => {
    const result = loader.loadSettingsScreen(storage);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const settings = await import('../../../src/screens/SettingsScreen');
    expect(settings.loadSettingsScreen).toHaveBeenCalledTimes(1);
  });

  it('exports loadSearchScreen as a function and maps FeedVideo to search shape', async () => {
    const videos = [{ videoId: 'v1', title: 'Test', thumbnail: 't.png', progress: 0 }];
    const onVideoSelect = vi.fn();
    const result = loader.loadSearchScreen(videos, onVideoSelect);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const search = await import('../../../src/screens/SearchScreen');
    expect(search.loadSearchScreen).toHaveBeenCalledTimes(1);
    expect(search.loadSearchScreen).toHaveBeenCalledWith(
      [
        {
          id: 'v1',
          title: 'Test',
          shortDescription: '',
          hdPosterUrl: 't.png',
          sdPosterUrl: 't.png',
        },
      ],
      onVideoSelect
    );
  });
});
