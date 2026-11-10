/**
 * App DeepLinking integration — verify the deep link parser is wired into
 * loadMainViewWrapper so that a deep link in the URL navigates to the video
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
    captureError: vi.fn(),
    saveCrash: vi.fn(),
    getPendingCrashes: vi.fn(() => []),
    clearCrashes: vi.fn(),
    addToWatchLater: vi.fn(),
    removeFromWatchLater: vi.fn(),
    getWatchLater: vi.fn(() => []),
    ensureClientConfig: vi.fn(() =>
      Promise.resolve(actual.resolveClientConfig({ bundled: null, remote: null }))
    ),
    getEffectiveConfig: vi.fn(() => actual.DEFAULT_CLIENT_CONFIG),
    resolveAnalyticsEndpoint: actual.resolveAnalyticsEndpoint,
    startConfigRefresh: vi.fn(() => vi.fn()),
  };
});

vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  getContinueWatching: vi.fn(() => []),
}));

vi.mock('@ctv/core/watch-later/WatchLater', () => ({
  getWatchLater: vi.fn(() => []),
  removeFromWatchLater: vi.fn(),
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

vi.mock('../../src/Adapter/CrashReporter', () => ({
  flushCrashReports: vi.fn(),
}));

vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: vi.fn(() => ({ dismiss: vi.fn() })),
}));

vi.mock('../../src/screenLoader', () => ({
  // The mock does NOT call onFeedLoaded — the test invokes it manually
  // after capturing the actions from this call.
  loadMainView: vi.fn(),
  loadScheduleScreen: vi.fn(),
  loadContinueWatchingScreen: vi.fn(),
  loadWatchLaterScreen: vi.fn(),
  loadSettingsScreen: vi.fn(),
  loadSearchScreen: vi.fn(),
  createContentDetail: vi.fn(() => Promise.resolve(document.createElement('div'))),
  createVideoScreen: vi.fn(() => Promise.resolve(document.createElement('div'))),
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

vi.mock('../../src/ui/ContentDetail', () => ({
  createContentDetail: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/ui/VideoScreen', () => ({
  createVideoScreen: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/utils/ErrorHandling', () => ({
  renderErrorScreen: vi.fn(() => '<div>Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error', retryable: true })),
  withErrorBoundary: vi.fn(
    (fn: (...args: unknown[]) => unknown, _onError?: (error: Error) => void) => fn
  ),
  handleVideoError: vi.fn(),
  handleFeedError: vi.fn(),
}));

vi.mock('../../src/styles.css', () => ({}));

describe('App DeepLinking integration', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-container">
        <div id="screen-grid" class="screen"></div>
        <div id="screen-content-detail" class="screen"></div>
        <div id="screen-video" class="screen"></div>
      </div>
      <div id="content-grid"></div>
      <div id="left-nav"></div>
      <div id="video-player"></div>
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
    await import('../../src/App');

    // Wait for auto-boot to complete (initApp → loadMainViewWrapper → loadMainView)
    await vi.waitFor(() => {
      expect(vi.mocked(screenLoader.loadMainView).mock.calls.length).toBeGreaterThan(0);
    });

    // Get the actions from the last call to loadMainView
    const calls = vi.mocked(screenLoader.loadMainView).mock.calls;
    const lastCall = calls[calls.length - 1];
    const actions = lastCall[2] as unknown as Record<string, unknown>;

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

    // Assert deep link navigation was called with the videos (includes extra FeedVideo fields)
    expect(checkAndNavigateMock).toHaveBeenCalledTimes(1);
    expect(checkAndNavigateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ videoId: 'video1', title: 'Video One' }),
        expect.objectContaining({ videoId: 'video2', title: 'Video Two' }),
      ])
    );
  });

  it('initDeepLinking is called during initApp', async () => {
    // App.ts is already imported and auto-booted (initApp already ran).
    // Clear initDeepLinking spy, then re-run initApp to verify it's called.
    const { initDeepLinking } = await import('@ctv/shared/ui/DeepLinking');
    const app = await import('../../src/App');

    vi.mocked(initDeepLinking).mockClear();

    // Re-run initApp to test it again
    await app.initApp();

    expect(initDeepLinking).toHaveBeenCalled();
  });
});
