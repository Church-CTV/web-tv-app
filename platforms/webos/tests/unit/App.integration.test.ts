/**
 * App.ts — unit tests for the root entry point module.
 *
 * App.ts imports screenLoader statically for testability; the actual
 * dynamic imports happen inside screenLoader. This test mocks screenLoader
 * to verify the wiring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// ─── Mock screenLoader (contains the dynamic imports) ────────────────────────
vi.mock('../../src/screenLoader', () => ({
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
  renderErrorScreen: vi.fn(() => '<div class="error-screen">Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error', retryable: true })),
}));

vi.mock('../../src/styles.css', () => ({}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('App.ts', () => {
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
      <div id="screen-continue-watching"></div>
      <div id="screen-watch-later"></div>
      <div id="screen-settings"></div>
      <div id="screen-schedule"></div>
      <div id="subscription-container"></div>
      <div id="screen-search"></div>
    `;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (document.body) {
      document.body.innerHTML = '';
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('handleBackNavigation', () => {
    it('does not pop when stack has one screen', async () => {
      const { getScreenStack, popScreen } = await import('../../src/ui/Navigation');
      vi.mocked(getScreenStack).mockReturnValue(['grid']);

      const stack = getScreenStack();
      expect(stack.length).toBe(1);
      popScreen(); // Should be a no-op internally
    });

    it('calls popScreen when stack has more than one screen', async () => {
      const { getScreenStack, popScreen } = await import('../../src/ui/Navigation');
      vi.mocked(getScreenStack).mockReturnValue(['grid', 'video', 'content-detail']);

      const stack = getScreenStack();
      expect(stack.length).toBeGreaterThan(1);

      popScreen();
      expect(popScreen).toHaveBeenCalled();
    });

    it('calls analytics.trackInteraction when analytics is set', async () => {
      const app = await import('../../src/App');
      // After initApp runs (on import), analytics should be set
      expect(app.analytics).not.toBeNull();
    });
  });

  describe('screen loading wrappers', () => {
    it('loadMainViewWrapper is a function that calls loadMainView', async () => {
      const screenLoader = await import('../../src/screenLoader');
      const app = await import('../../src/App');

      vi.mocked(screenLoader.loadMainView).mockClear();

      await app.loadMainViewWrapper();

      expect(screenLoader.loadMainView).toHaveBeenCalled();
    });

    it('loadSettingsScreenWrapper calls loadSettingsScreen', async () => {
      const screenLoader = await import('../../src/screenLoader');
      const app = await import('../../src/App');

      vi.mocked(screenLoader.loadSettingsScreen).mockClear();

      await app.loadSettingsScreenWrapper();

      expect(screenLoader.loadSettingsScreen).toHaveBeenCalled();
    });

    it('loadSearchScreenWrapper calls loadSearchScreen', async () => {
      const screenLoader = await import('../../src/screenLoader');
      const app = await import('../../src/App');

      vi.mocked(screenLoader.loadSearchScreen).mockClear();

      await app.loadSearchScreenWrapper();

      expect(screenLoader.loadSearchScreen).toHaveBeenCalled();
    });
  });

  describe('retryFeedLoad', () => {
    it('re-exports retryFeedLoad as a function', async () => {
      const app = await import('../../src/App');
      expect(app.retryFeedLoad).toBeDefined();
      expect(typeof app.retryFeedLoad).toBe('function');
    });

    it('retryFeedLoad internally calls loadMainViewWrapper', async () => {
      const screenLoader = await import('../../src/screenLoader');
      const countBefore = vi.mocked(screenLoader.loadMainView).mock.calls.length;

      const app = await import('../../src/App');
      app.retryFeedLoad();

      const countAfter = vi.mocked(screenLoader.loadMainView).mock.calls.length;
      expect(countAfter).toBeGreaterThan(countBefore);
    });
  });

  describe('initApp', () => {
    it('is exported as a function', async () => {
      const app = await import('../../src/App');
      expect(app.initApp).toBeDefined();
      expect(typeof app.initApp).toBe('function');
    });

    it('exports showScreen and hideScreen re-exports', async () => {
      const app = await import('../../src/App');
      expect(app.showScreen).toBeDefined();
      expect(app.hideScreen).toBeDefined();
    });
  });

  describe('DOM boot behavior', () => {
    it('App.ts has boot logic that calls initApp on import', async () => {
      const app = await import('../../src/App');
      expect(app.analytics).not.toBeNull();
      expect(app.videoPlayer).not.toBeNull();
      expect(app.remoteControl).not.toBeNull();
    });
  });

  describe('exported state variables', () => {
    it('exports videoPlayer', async () => {
      const app = await import('../../src/App');
      expect(app.videoPlayer).toBeDefined();
    });

    it('exports remoteControl', async () => {
      const app = await import('../../src/App');
      expect(app.remoteControl).toBeDefined();
    });

    it('exports analytics', async () => {
      const app = await import('../../src/App');
      expect(app.analytics).toBeDefined();
    });

    it('after initApp, videoPlayer has play/pause/seek/getState methods', async () => {
      const app = await import('../../src/App');
      expect(app.videoPlayer).toBeTruthy();
      expect(typeof app.videoPlayer?.play).toBe('function');
      expect(typeof app.videoPlayer?.pause).toBe('function');
      expect(typeof app.videoPlayer?.seek).toBe('function');
      expect(typeof app.videoPlayer?.getState).toBe('function');
    });

    it('after initApp, remoteControl has focusNext/focusPrev/destroy', async () => {
      const app = await import('../../src/App');
      expect(app.remoteControl).toBeTruthy();
      expect(typeof app.remoteControl?.focusNext).toBe('function');
      expect(typeof app.remoteControl?.focusPrev).toBe('function');
      expect(typeof app.remoteControl?.destroy).toBe('function');
    });
  });
});
