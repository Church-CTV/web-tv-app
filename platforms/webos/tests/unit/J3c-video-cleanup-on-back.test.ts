/**
 * J3c — VideoPlayer timer cleanup on navigation (webOS).
 *
 * Bug: `handleBackNavigation()` in App.ts transitions from `screen-video`
 * to `screen-content-detail` via `showScreen()` when the user presses Back
 * on the remote, but never calls `cleanup()` on the `.video-screen`
 * element. This leaves:
 *   1. The `positionSaveTimer` (setInterval) running in the background
 *   2. All event listeners (play/pause/ended/timeupdate/error) still active
 *   3. The video element still buffering or streaming
 *
 * Each back-navigation from the video screen leaks a running timer and
 * stale event handler closures.
 *
 * Fix: In `handleBackNavigation()`, when `activeId === 'screen-video'`,
 * call `cleanup()` on the `.video-screen` element before showing the
 * content detail screen.
 *
 * This is a webOS-specific bug — Tizen/Vizio use a shared video element
 * and a different navigation stack (no dynamic video screen DOM).
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Mocks (same pattern as J3a-video-replacement.test.ts) ────────────────────

const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadScheduleScreenSpy = vi.fn(() => Promise.resolve());
const loadContinueWatchingScreenSpy = vi.fn(() => Promise.resolve());
const loadWatchLaterScreenSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSubscriptionScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());

// Track each created video screen and its cleanup calls.
const createdVideoScreens: HTMLDivElement[] = [];
const cleanupCalls: string[] = [];

const createContentDetailSpy = vi.fn((_video: { id: string }, _callbacks: unknown) => {
  const el = document.createElement('div');
  el.className = 'content-detail';
  (el as HTMLDivElement & { cleanup: () => void }).cleanup = () => {};
  return Promise.resolve(el);
});

const createVideoScreenSpy = vi.fn(() => {
  const screen = document.createElement('div');
  screen.className = 'video-screen';
  const screenTag = `video-screen-${createdVideoScreens.length + 1}`;
  (screen as HTMLDivElement & { cleanup: () => void }).cleanup = () => {
    cleanupCalls.push(screenTag);
  };
  createdVideoScreens.push(screen);
  return Promise.resolve(screen);
});

const videoPlayerPlaySpy = vi.fn();
const videoPlayerStopSpy = vi.fn();
const trackInteractionSpy = vi.fn();

vi.mock('../../src/screenLoader', () => ({
  loadMainView: loadMainViewSpy,
  loadScheduleScreen: loadScheduleScreenSpy,
  loadContinueWatchingScreen: loadContinueWatchingScreenSpy,
  loadWatchLaterScreen: loadWatchLaterScreenSpy,
  loadSettingsScreen: loadSettingsScreenSpy,
  loadSubscriptionScreen: loadSubscriptionScreenSpy,
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
    stop: videoPlayerStopSpy,
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

// Import App after mocks are set up
const AppModule = await import('../../src/App');

const { initApp, loadMainViewWrapper, handleBackNavigation } = AppModule;

// ── Helpers ───────────────────────────────────────────────────────────────────

type ScreenActionMap = {
  onVideoSelect: (id: string, title: string) => Promise<void>;
  onFeedLoaded: (videos: unknown) => void;
};

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

function captureActions(): ScreenActionMap {
  const calls = loadMainViewSpy.mock.calls as unknown[][];
  const call = calls[calls.length - 1];
  if (!call) throw new Error('loadMainView was not called');
  return call[2] as ScreenActionMap;
}

async function playVideo(videoId: string, title: string): Promise<void> {
  const actions = captureActions();
  // Selection plays the video directly now (no detail screen).
  await actions.onVideoSelect(videoId, title);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  setScreenDOM();
  await initApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  setScreenDOM();
  // Reset leak trackers
  createdVideoScreens.length = 0;
  cleanupCalls.length = 0;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('J3c: VideoPlayer timer cleanup on back navigation', () => {
  it('calls cleanup() on the video screen when the user navigates back', async () => {
    await loadMainViewWrapper();

    await playVideo('v1', 'Video One');

    // Sanity: video screen is active
    const activeId = document.querySelector('.screen.screen-active')?.id;
    expect(activeId).toBe('screen-video');

    // No cleanup has happened yet (only one video played)
    expect(cleanupCalls).toHaveLength(0);

    // Navigate back from the video screen
    handleBackNavigation();

    // RED: currently the back handler only calls showScreen('screen-content-detail')
    // and never cleans up the video screen's timers/listeners.
    expect(
      cleanupCalls.length,
      'cleanup() should be called on the video screen when navigating back'
    ).toBeGreaterThanOrEqual(1);
  });

  it('leaves no video-screen timer running after back navigation', async () => {
    await loadMainViewWrapper();

    await playVideo('v1', 'Video One');

    // Spy directly on the created screen element's cleanup.
    const videoScreenEl = createdVideoScreens[0];
    expect(videoScreenEl).toBeDefined();
    const cleanupSpy = vi.fn();
    (videoScreenEl as HTMLDivElement & { cleanup: () => void }).cleanup = cleanupSpy;

    handleBackNavigation();

    // RED: cleanup is never invoked on back navigation.
    expect(
      cleanupSpy,
      'cleanup() should be invoked on the video screen element when back-navigating'
    ).toHaveBeenCalled();
  });

  it('stops the shared video player when back-navigating from the video screen', async () => {
    await loadMainViewWrapper();

    await playVideo('v1', 'Video One');

    // Reset call count after play
    vi.clearAllMocks();
    expect(videoPlayerStopSpy).not.toHaveBeenCalled();

    handleBackNavigation();

    // RED: back navigation currently never calls stop() on the shared
    // video player — the stream keeps downloading in the background.
    expect(
      videoPlayerStopSpy,
      'videoPlayer.stop() should be called when back-navigating from the video screen'
    ).toHaveBeenCalled();
  });
});
