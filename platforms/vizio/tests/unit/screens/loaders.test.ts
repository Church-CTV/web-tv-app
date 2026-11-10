/**
 * Vizio screen loaders — unit tests for load* wrapper functions.
 * Tests that each loader fetches data and renders to the DOM correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock @ctv/core — mock get so tests control responses; keep real error-classification exports
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    get: vi.fn(),
    mapHttpError: actual.mapHttpError,
    isUserFacingError: actual.isUserFacingError,
    isRetryable: actual.isRetryable,
    HttpError: actual.HttpError,
    getServerBaseUrl: vi.fn(() => 'http://localhost:3000'),
    validateFeed: vi.fn((feed: unknown) => ({
      valid: true,
      errors: [],
      warnings: [],
      videoCount: 0,
      feed,
    })),
    getMonthKeys: vi.fn((feed: Record<string, unknown[]>) => Object.keys(feed)),
  };
});

// Mock @ctv/core/continue-watching
vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  getContinueWatching: vi.fn((storage: { get: (k: string) => string | null }) => {
    const data = storage.get('ctv_continue_watching');
    return data ? JSON.parse(data) : [];
  }),
}));

// Mock @ctv/core/watch-later
vi.mock('@ctv/core/watch-later/WatchLater', () => ({
  getWatchLater: vi.fn((storage: { get: (k: string) => string | null }) =>
    storage.get('ctv_watch_later') ? JSON.parse(storage.get('ctv_watch_later') as string) : []
  ),
  removeFromWatchLater: vi.fn(
    (
      storage: { get: (k: string) => string | null; set: (k: string, v: string) => void },
      videoId: string
    ) => {
      const data = storage.get('ctv_watch_later');
      const items = data ? JSON.parse(data) : [];
      const filtered = items.filter((i: { videoId: string }) => i.videoId !== videoId);
      storage.set('ctv_watch_later', JSON.stringify(filtered));
    }
  ),
}));

// Mock @ctv/shared ErrorHandling
vi.mock('@ctv/shared/ErrorHandling', () => ({
  renderErrorScreen: vi.fn(() => '<div class="error-screen">Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error', type: 'feed' })),
}));

// Mock visibility
const showScreenMock = {
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
};
vi.mock('../../../src/screens/visibility', () => showScreenMock);

// ─── UI mocks (typed so mock.calls assertions pass strict typecheck) ──────────

const uiScheduleMock = {
  renderScheduleScreen: vi.fn((_entries: unknown[]) => '<div class="schedule-screen"></div>'),
  initScheduleScreen: vi.fn((_el: HTMLDivElement, _opts?: unknown) => {}),
};
vi.mock('../../../src/ui/ScheduleScreen', () => uiScheduleMock);

interface SearchLoaderProps {
  videos: Array<{
    id: string;
    title: string;
    shortDescription: string;
    hdPosterUrl: string;
    sdPosterUrl: string;
  }>;
  onVideoSelect: (videoId: string) => void;
}
const uiSearchMock = {
  renderSearchScreen: vi.fn((_props: SearchLoaderProps) => '<div class="search-screen"></div>'),
  initSearchScreen: vi.fn((_el: HTMLDivElement, _props: SearchLoaderProps) => {}),
};
vi.mock('../../../src/ui/SearchScreen', () => uiSearchMock);

const uiSettingsMock = {
  renderSettingsScreen: vi.fn(
    () =>
      '<div class="settings-screen"><a class="settings-give__link" href="https://giving.example.test/donate">Give</a></div>'
  ),
  initSettingsScreen: vi.fn((_storage: unknown, _onRetry?: () => void) => {}),
};
vi.mock('../../../src/ui/SettingsScreen', () => uiSettingsMock);

interface ContinueWatchingLoaderItems {
  videoId: string;
  title: string;
  position: number;
  duration: number;
  thumbnail: string;
}
const uiContinueMock = {
  renderContinueWatchingScreen: vi.fn(
    (props: {
      items: ContinueWatchingLoaderItems[];
      onVideoSelect?: (videoId: string, position: number) => void;
    }) => '<div class="continue-watching-screen"></div>'
  ),
  initContinueWatchingScreen: vi.fn((_props: unknown) => {}),
};
vi.mock('../../../src/ui/ContinueWatchingScreen', () => uiContinueMock);

const uiWatchLaterMock = {
  renderWatchLaterScreen: vi.fn(
    (props: {
      items: Array<{ videoId: string; title: string; addedAt: string }>;
      onRemove?: (videoId: string) => void;
    }) => '<div class="watch-later-screen"></div>'
  ),
  initWatchLaterScreen: vi.fn((_props: unknown) => {}),
};
vi.mock('../../../src/ui/WatchLaterScreen', () => uiWatchLaterMock);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mockStorage(items: Record<string, string> = {}) {
  const store = { ...items };
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, value: string) => {
      store[key] = value;
    },
    remove: (key: string) => {
      delete store[key];
    },
    getAll: () => ({ ...store }),
  };
}

function resetDOM(html = '') {
  document.body.innerHTML = html;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Vizio ScheduleScreen loader', () => {
  let loadScheduleScreen: typeof import('../../../src/screens/ScheduleScreen').loadScheduleScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-schedule" class="screen"></div>');
    loadScheduleScreen = (await import('../../../src/screens/ScheduleScreen')).loadScheduleScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('fetches schedule from server and renders on success', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { programs: [{ title: 'Show 1' }] },
    });

    await loadScheduleScreen(mockStorage(), { onPlay: vi.fn() });

    expect(get).toHaveBeenCalledWith(
      'http://localhost:3000/schedule',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(uiScheduleMock.renderScheduleScreen).toHaveBeenCalled();
    expect(uiScheduleMock.initScheduleScreen).toHaveBeenCalled();
  });

  it('handles programs array at root instead of under programs key', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: [{ title: 'Root Show' }],
    });

    await loadScheduleScreen(mockStorage(), { onPlay: vi.fn() });

    expect(uiScheduleMock.renderScheduleScreen).toHaveBeenCalledTimes(1);
    const entries = (uiScheduleMock.renderScheduleScreen as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as Array<{ title: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Root Show');
  });

  it('renders error screen on non-ok response', async () => {
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('http', 'HTTP 500: Internal Server Error', 500)
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await loadScheduleScreen(mockStorage(), { onPlay: vi.fn() });

    expect(uiScheduleMock.renderScheduleScreen).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('renders error screen on fetch exception', async () => {
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('network', 'Network error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await loadScheduleScreen(mockStorage(), { onPlay: vi.fn() });

    expect(uiScheduleMock.renderScheduleScreen).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadScheduleScreen(mockStorage(), { onPlay: vi.fn() })).resolves.toBeUndefined();
  });
});

describe('Vizio SearchScreen loader', () => {
  let loadSearchScreen: typeof import('../../../src/screens/SearchScreen').loadSearchScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-search" class="screen"></div>');
    loadSearchScreen = (await import('../../../src/screens/SearchScreen')).loadSearchScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders search screen with videos and calls initSearchScreen', async () => {
    const videos = [
      {
        id: 'v1',
        title: 'Video One',
        shortDescription: 'd1',
        hdPosterUrl: 'h1',
        sdPosterUrl: 's1',
      },
      {
        id: 'v2',
        title: 'Video Two',
        shortDescription: 'd2',
        hdPosterUrl: 'h2',
        sdPosterUrl: 's2',
      },
    ];
    await loadSearchScreen(videos, vi.fn());

    // One mount, one call: the shared init owns the render now, because the loader
    // used to render into the container and then hand the same container to
    // initSearchScreen, which re-rendered it. Two calls per open is what stacked the
    // D-pad handler on the permanent #screen-search element.
    expect(uiSearchMock.renderSearchScreen).not.toHaveBeenCalled();
    expect(uiSearchMock.initSearchScreen).toHaveBeenCalledTimes(1);
    const props = (uiSearchMock.initSearchScreen as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { videos: unknown[] };
    expect(props.videos).toHaveLength(2);
    expect((props.videos[0] as { id: string }).id).toBe('v1');
  });

  it('handles empty video list', async () => {
    await loadSearchScreen([], vi.fn());
    expect(uiSearchMock.initSearchScreen).toHaveBeenCalledTimes(1);
    const props = (uiSearchMock.initSearchScreen as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { videos: unknown[] };
    expect(props.videos).toHaveLength(0);
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadSearchScreen([], vi.fn())).resolves.toBeUndefined();
  });
});

describe('Vizio SettingsScreen loader', () => {
  let loadSettingsScreen: typeof import('../../../src/screens/SettingsScreen').loadSettingsScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-settings" class="screen"></div>');
    loadSettingsScreen = (await import('../../../src/screens/SettingsScreen')).loadSettingsScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders and focuses the Roku giving link without obsolete control handlers', async () => {
    await loadSettingsScreen(mockStorage());

    expect(uiSettingsMock.renderSettingsScreen).toHaveBeenCalled();
    expect(uiSettingsMock.initSettingsScreen).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-give__link')).toBe(document.activeElement);
    expect(document.getElementById('screen-settings')).toBeTruthy();
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadSettingsScreen(mockStorage())).resolves.toBeUndefined();
  });
});

describe('Vizio ContinueWatchingScreen loader', () => {
  let loadContinueWatchingScreen: typeof import('../../../src/screens/ContinueWatchingScreen').loadContinueWatchingScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-continue-watching" class="screen"></div>');
    loadContinueWatchingScreen = (await import('../../../src/screens/ContinueWatchingScreen'))
      .loadContinueWatchingScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders continue watching items from storage', async () => {
    const storage = mockStorage({
      ctv_continue_watching: JSON.stringify([
        { videoId: 'cw-1', title: 'V1', position: 120, duration: 3600 },
        { videoId: 'cw-2', title: 'V2', position: 30, duration: 1800 },
      ]),
    });

    await loadContinueWatchingScreen(storage, undefined);

    expect(uiContinueMock.renderContinueWatchingScreen).toHaveBeenCalledTimes(1);
    expect(uiContinueMock.initContinueWatchingScreen).toHaveBeenCalled();
    const props = (
      uiContinueMock.renderContinueWatchingScreen as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { items: unknown[] };
    expect(props.items).toHaveLength(2);
  });

  it('renders empty state when no items in storage', async () => {
    await loadContinueWatchingScreen(mockStorage(), undefined);
    expect(uiContinueMock.renderContinueWatchingScreen).toHaveBeenCalled();
    const props = (
      uiContinueMock.renderContinueWatchingScreen as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { items: unknown[] };
    expect(props.items).toHaveLength(0);
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadContinueWatchingScreen(mockStorage(), undefined)).resolves.toBeUndefined();
  });

  it('onVideoSelect creates a video screen element and shows it without a player', async () => {
    resetDOM('<div class="app"><div id="screen-continue-watching" class="screen"></div></div>');
    await loadContinueWatchingScreen(
      mockStorage({
        ctv_continue_watching: JSON.stringify([
          { videoId: 'cw-1', title: 'V1', position: 120, duration: 3600 },
        ]),
      }),
      undefined
    );
    const props = (
      uiContinueMock.renderContinueWatchingScreen as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { onVideoSelect?: (videoId: string, position: number) => void };
    expect(props.onVideoSelect).toBeDefined();
    props.onVideoSelect!('cw-1', 120);

    const videoScreenEl = document.querySelector('.video-screen');
    expect(videoScreenEl).not.toBeNull();
    expect(videoScreenEl?.getAttribute('data-video-id')).toBe('cw-1');
    expect(showScreenMock.showScreen).toHaveBeenCalledWith('screen-video');
  });

  it('onVideoSelect seeks and plays the video when a player is provided', async () => {
    const player = {
      seek: vi.fn(),
      play: vi.fn(),
    } as unknown as import('../../../src/Adapter/VideoPlayer').VideoPlayer;
    resetDOM('<div class="app"><div id="screen-continue-watching" class="screen"></div></div>');
    await loadContinueWatchingScreen(
      mockStorage({
        ctv_continue_watching: JSON.stringify([
          { videoId: 'cw-2', title: 'V2', position: 30, duration: 1800 },
        ]),
      }),
      player
    );
    const props = (
      uiContinueMock.renderContinueWatchingScreen as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { onVideoSelect?: (videoId: string, position: number) => void };
    props.onVideoSelect!('cw-2', 30);

    expect(player.seek).toHaveBeenCalledWith(30);
    expect(player.play).toHaveBeenCalledWith('/stream/cw-2.mp4');
  });
});

describe('Vizio WatchLaterScreen loader', () => {
  let loadWatchLaterScreen: typeof import('../../../src/screens/WatchLaterScreen').loadWatchLaterScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-watch-later" class="screen"></div>');
    loadWatchLaterScreen = (await import('../../../src/screens/WatchLaterScreen'))
      .loadWatchLaterScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders watch later items from storage', async () => {
    const storage = mockStorage({
      ctv_watch_later: JSON.stringify([
        { videoId: 'wl-1', title: 'Watch Later 1', addedAt: '2026-01-01T00:00:00Z' },
      ]),
    });

    await loadWatchLaterScreen(storage);

    expect(uiWatchLaterMock.renderWatchLaterScreen).toHaveBeenCalledTimes(1);
    expect(uiWatchLaterMock.initWatchLaterScreen).toHaveBeenCalled();
    const props = (uiWatchLaterMock.renderWatchLaterScreen as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { items: unknown[] };
    expect(props.items).toHaveLength(1);
  });

  it('renders empty state when no items in storage', async () => {
    await loadWatchLaterScreen(mockStorage());
    expect(uiWatchLaterMock.renderWatchLaterScreen).toHaveBeenCalled();
    const props = (uiWatchLaterMock.renderWatchLaterScreen as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { items: unknown[] };
    expect(props.items).toHaveLength(0);
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadWatchLaterScreen(mockStorage())).resolves.toBeUndefined();
  });
});
