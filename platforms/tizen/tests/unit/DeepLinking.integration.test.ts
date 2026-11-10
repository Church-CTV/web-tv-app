/**
 * Tizen App DeepLinking integration — verify the deep link parser is wired
 * into loadMainViewWrapper so a deep link in the URL navigates to the video
 * once the feed loads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock shared DeepLinking ──────────────────────────────────────────────────
const checkAndNavigateMock = vi.fn(() => true);
const getDeepLinkMock = vi.fn(() => ({ videoId: null, source: null, found: false }));
vi.mock('@ctv/shared/ui/DeepLinking', () => ({
  initDeepLinking: vi.fn(() => ({
    checkAndNavigate: checkAndNavigateMock,
    getDeepLink: getDeepLinkMock,
  })),
}));

// ─── Mock @ctv/core ───────────────────────────────────────────────────────────
const coreAnalyticsMock = {
  init: vi.fn(),
  trackInteraction: vi.fn(),
  trackContentPlay: vi.fn(),
  shutdown: vi.fn(),
  setOptOut: vi.fn(),
};

vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    getServerBaseUrl: vi.fn(() => 'http://localhost:3000'),
    validateFeed: vi.fn(() => ({ valid: true, errors: [], warnings: [], videoCount: 0 })),
    getMonthKeys: vi.fn(() => ['2026-07']),
    groupVideosByMonth: vi.fn(() => ({})),
    saveServerConfig: vi.fn(),
    loadServerConfig: vi.fn(() => null),
    validateServerConfig: vi.fn(() => null),
    getShareUsagePreference: vi.fn(() => false),
    Analytics: vi.fn().mockImplementation(() => coreAnalyticsMock),
    addToWatchLater: vi.fn(),
    ensureClientConfig: vi.fn(() =>
      Promise.resolve(actual.resolveClientConfig({ bundled: null, remote: null }))
    ),
    getEffectiveConfig: vi.fn(() => actual.DEFAULT_CLIENT_CONFIG),
    resolveAnalyticsEndpoint: actual.resolveAnalyticsEndpoint,
    startConfigRefresh: vi.fn(() => vi.fn()),
  };
});

vi.mock('@ctv/core/watch-later/WatchLater', () => ({
  addToWatchLater: vi.fn(),
}));

vi.mock('../../src/modules/initStorage', () => ({
  createStorage: vi.fn(() => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
    getAll: vi.fn(() => ({})),
  })),
}));

vi.mock('../../src/modules/initVideoPlayer', () => ({
  createVideoPlayer: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    getState: vi.fn(() => 'idle'),
  })),
}));

vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: vi.fn(() => ({
    focusNext: vi.fn(),
    focusPrev: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: vi.fn(() => coreAnalyticsMock),
}));

vi.mock('../../src/modules/initCrashReporting', () => ({
  createCrashReporter: vi.fn(),
}));

vi.mock('../../src/Adapter/Analytics', () => ({
  createAnalyticsExport: vi.fn(() => vi.fn()),
}));

vi.mock('../../src/screenLoader', () => ({
  // The mock does NOT call onFeedLoaded — the test invokes it manually
  loadMainView: vi.fn(),
  loadScheduleScreen: vi.fn(),
  loadContinueWatchingScreen: vi.fn(),
  loadWatchLaterScreen: vi.fn(),
  loadSettingsScreen: vi.fn(),
  loadSearchScreen: vi.fn(),
}));

vi.mock('../../src/screens/visibility', () => ({
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
}));

vi.mock('../../src/ui/Navigation', () => ({
  pushScreen: vi.fn(),
  popScreen: vi.fn(),
  getScreenStack: vi.fn(() => []),
}));

describe('Tizen App DeepLinking integration', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-container"></div>
      <div id="screen-grid" class="screen screen-active"></div>
      <div id="screen-content-detail" class="screen"></div>
      <div id="screen-video" class="screen"></div>
    `;
    checkAndNavigateMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes onFeedLoaded action to loadMainView that triggers deep link navigation', async () => {
    const screenLoader = await import('../../src/screenLoader');
    const app = await import('../../src/App');
    // Drain automatic startup before testing an explicit fresh initialization.
    await app.initApp();

    // Re-run initApp to get a fresh loadMainViewWrapper call
    const { initDeepLinking } = await import('@ctv/shared/ui/DeepLinking');
    vi.mocked(initDeepLinking).mockClear();
    vi.mocked(screenLoader.loadMainView).mockClear();

    await app.initApp();

    // Get the actions from the call to loadMainView
    expect(screenLoader.loadMainView).toHaveBeenCalled();
    const lastCall = vi.mocked(screenLoader.loadMainView).mock.calls.at(-1);
    const actions = lastCall![2] as unknown as Record<string, unknown>;

    // Assert onFeedLoaded is defined
    expect(actions.onFeedLoaded).toBeDefined();
    expect(typeof actions.onFeedLoaded).toBe('function');

    // Reset checkAndNavigateMock so we only count calls from our test
    checkAndNavigateMock.mockClear();

    // Simulate the feed load callback with videos
    const onFeedLoaded = actions.onFeedLoaded as (
      videos: Array<{ videoId: string; title: string; thumbnail: string; progress: number }>
    ) => void;

    onFeedLoaded([
      { videoId: 'video1', title: 'Video One', thumbnail: '', progress: 0 },
      { videoId: 'video2', title: 'Video Two', thumbnail: '', progress: 0 },
    ]);

    // Assert deep link navigation was called with the videos
    expect(checkAndNavigateMock).toHaveBeenCalledTimes(1);
    expect(checkAndNavigateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ videoId: 'video1', title: 'Video One' }),
        expect.objectContaining({ videoId: 'video2', title: 'Video Two' }),
      ])
    );
  });

  it('initDeepLinking is called during initApp', async () => {
    const app = await import('../../src/App');
    // Drain automatic startup before testing an explicit fresh initialization.
    await app.initApp();
    const { initDeepLinking } = await import('@ctv/shared/ui/DeepLinking');

    vi.mocked(initDeepLinking).mockClear();

    // Re-run initApp to test it again
    await app.initApp();

    expect(initDeepLinking).toHaveBeenCalled();
  });
});
