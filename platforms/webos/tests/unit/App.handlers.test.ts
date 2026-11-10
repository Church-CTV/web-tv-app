/**
 * WebOS App — handler function tests.
 *
 * Covers:
 * - handleBackNavigation (video → grid, other → grid, grid/loading → no-op)
 * - Screen loader wrappers delegate to screenLoader
 * - onVideoSelect → plays the video directly (no detail screen), mounting the
 *   video screen + starting playback with the stream URL
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { showScreen, getActiveScreenId } from '../../src/screens/visibility';

// Track screenLoader calls via vi.fn()
const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());
const createContentDetailSpy = vi.fn(() => {
  const el = document.createElement('div');
  (el as HTMLDivElement & { cleanup: () => void }).cleanup = () => {};
  return Promise.resolve(el);
});
const createVideoScreenSpy = vi.fn(() => Promise.resolve(document.createElement('div')));

const trackInteractionSpy = vi.fn();
const videoPlayerPlaySpy = vi.fn();

vi.mock('../../src/screenLoader', () => ({
  loadMainView: loadMainViewSpy,
  loadSettingsScreen: loadSettingsScreenSpy,
  loadSearchScreen: loadSearchScreenSpy,
  createContentDetail: createContentDetailSpy,
  createVideoScreen: createVideoScreenSpy,
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
    play: videoPlayerPlaySpy,
    stop: vi.fn(),
  })),
}));
vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: vi.fn(() => ({
    onKeyPress: vi.fn(),
    focusNext: vi.fn(),
    focusPrev: vi.fn(),
    destroy: vi.fn(),
  })),
}));
vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: vi.fn(() => ({
    init: vi.fn(),
    trackInteraction: trackInteractionSpy,
    trackContentPlay: vi.fn(),
    shutdown: vi.fn(),
    setOptOut: vi.fn(),
  })),
}));
vi.mock('../../src/modules/initCrashReporting', () => ({
  createCrashReporter: vi.fn(),
}));
vi.mock('../../src/Adapter/Analytics', () => ({
  createAnalyticsExport: vi.fn(() => vi.fn(async () => {})),
}));
vi.mock('../../src/Adapter/CrashReporter', () => ({
  flushCrashReports: vi.fn(),
}));
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: vi.fn(() => ({
    dismiss: vi.fn(),
  })),
}));

// Import App AFTER mocks are set up
const AppModule = await import('../../src/App');

const {
  initApp,
  handleBackNavigation,
  loadMainViewWrapper,
  loadSettingsScreenWrapper,
  loadSearchScreenWrapper,
} = AppModule;

function setScreenDOM() {
  document.body.innerHTML = `
    <div id="app">
      <div id="screen-container">
        <div id="screen-grid" class="screen">Grid</div>
        <div id="screen-video" class="screen" style="display:none">Video</div>
        <div id="screen-content-detail" class="screen" style="display:none">Detail</div>
        <div id="screen-loading" class="screen" style="display:none">Loading</div>
      </div>
    </div>
  `;
}

type ScreenActionMap = {
  onVideoSelect: (id: string, title: string) => Promise<void>;
  onFeedLoaded: (videos: unknown) => void;
};

function captureActionsFromLoadMainView(): ScreenActionMap {
  const calls = loadMainViewSpy.mock.calls as unknown[][];
  const call = calls[calls.length - 1];
  if (!call) throw new Error('loadMainView was not called');
  return call[2] as ScreenActionMap;
}

beforeAll(async () => {
  setScreenDOM();
  // Explicitly init the app so internal state (analytics, videoPlayer) is set.
  // The module's auto-boot also runs initApp, but calling it directly here
  // ensures deterministic setup before tests.
  await initApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  setScreenDOM();
});

describe('App handlers', () => {
  describe('handleBackNavigation', () => {
    it('navigates from video screen to grid', () => {
      showScreen('screen-video');
      expect(getActiveScreenId()).toBe('screen-video');

      handleBackNavigation();

      expect(getActiveScreenId()).toBe('screen-grid');
    });

    it('navigates from a non-grid screen to grid', () => {
      document.body.innerHTML += `<div id="screen-search" class="screen">Search</div>`;
      showScreen('screen-search');

      handleBackNavigation();

      expect(getActiveScreenId()).toBe('screen-grid');
    });

    it('does nothing when already on grid', () => {
      showScreen('screen-grid');

      handleBackNavigation();

      expect(getActiveScreenId()).toBe('screen-grid');
    });

    it('does nothing when on loading screen', () => {
      showScreen('screen-loading');

      handleBackNavigation();

      expect(getActiveScreenId()).toBe('screen-loading');
    });

    it('does nothing when no screen is active', () => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('screen-active'));

      handleBackNavigation();

      expect(getActiveScreenId()).toBeNull();
    });

    it('tracks back navigation analytics event', () => {
      showScreen('screen-video');

      handleBackNavigation();

      expect(trackInteractionSpy).toHaveBeenCalledWith('back');
    });
  });

  describe('screen loader wrappers', () => {
    it('loadMainViewWrapper delegates to screenLoader.loadMainView', async () => {
      await loadMainViewWrapper();
      expect(loadMainViewSpy).toHaveBeenCalledTimes(1);
    });

    it('loadSettingsScreenWrapper delegates to screenLoader.loadSettingsScreen', async () => {
      await loadSettingsScreenWrapper();
      expect(loadSettingsScreenSpy).toHaveBeenCalledTimes(1);
    });

    it('loadSearchScreenWrapper delegates to screenLoader.loadSearchScreen', async () => {
      await loadSearchScreenWrapper();
      expect(loadSearchScreenSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onVideoSelect → direct playback (no detail screen)', () => {
    it('plays the video directly: mounts the video screen and does NOT build a detail screen', async () => {
      await loadMainViewWrapper();
      const actions = captureActionsFromLoadMainView();

      await actions.onVideoSelect('v1', 'Test Video');

      // Selection goes straight to playback: no ContentDetail is built, and
      // the video screen is the active screen.
      expect(createContentDetailSpy).not.toHaveBeenCalled();
      expect(createVideoScreenSpy).toHaveBeenCalledTimes(1);
      expect(getActiveScreenId()).toBe('screen-video');
    });

    it('starts playback with the stream URL', async () => {
      await loadMainViewWrapper();
      const actions = captureActionsFromLoadMainView();

      await actions.onVideoSelect('v42', 'My Video');

      expect(videoPlayerPlaySpy).toHaveBeenCalledWith('/stream/v42.mp4');
      expect(getActiveScreenId()).toBe('screen-video');
    });

    it('tracks play interaction analytics event', async () => {
      await loadMainViewWrapper();
      const actions = captureActionsFromLoadMainView();

      trackInteractionSpy.mockClear();
      await actions.onVideoSelect('v100', 'Track Video');

      expect(trackInteractionSpy).toHaveBeenCalledWith('play', 'content-detail', 'v100');
    });
  });

  describe('onFeedLoaded', () => {
    it('accepts feed videos without throwing', async () => {
      await loadMainViewWrapper();
      const actions = captureActionsFromLoadMainView();

      const videos = [
        { videoId: 'v1', title: 'Video One', thumbnail: '', progress: 0 },
        { videoId: 'v2', title: 'Video Two', thumbnail: '', progress: 0 },
      ];

      expect(() => actions.onFeedLoaded(videos)).not.toThrow();
    });
  });
});
