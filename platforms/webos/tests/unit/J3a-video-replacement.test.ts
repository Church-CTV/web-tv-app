/**
 * J3a — VideoScreen DOM/listener/timer leak on repeated play.
 *
 * Bug: `handlePlay()` in App.ts appends a new `.video-screen` to
 * `#screen-container` every time a video is played, without calling
 * `cleanup()` on the previous screen or removing it from the DOM.
 *
 * After 3 plays, 3 video screens coexist. The old ones keep their
 * position-save `setInterval` timers and all their event listeners
 * attached to now-detached DOM elements.
 *
 * Fix: Before appending a new video screen, find and clean up the
 * previous `.video-screen` element.
 *
 * This is a webOS-specific bug — Tizen/Vizio use a shared video element.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Mocks (same pattern as App.handlers.test.ts) ──────────────────────────────

const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadScheduleScreenSpy = vi.fn(() => Promise.resolve());
const loadContinueWatchingScreenSpy = vi.fn(() => Promise.resolve());
const loadWatchLaterScreenSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSubscriptionScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());

// Track each created video screen so we can inspect the DOM state.
const createdVideoScreens: HTMLDivElement[] = [];
const cleanupCalls: string[] = [];

const createContentDetailSpy = vi.fn((video: { id: string }, _callbacks: unknown) => {
  const el = document.createElement('div');
  el.className = 'content-detail';
  (el as HTMLDivElement & { cleanup: () => void }).cleanup = () => {};
  return Promise.resolve(el);
});

const createVideoScreenSpy = vi.fn(() => {
  const screen = document.createElement('div');
  screen.className = 'video-screen';
  const videoId = `video-${createdVideoScreens.length + 1}`;
  (screen as HTMLDivElement & { cleanup: () => void }).cleanup = () => {
    cleanupCalls.push(videoId);
  };
  createdVideoScreens.push(screen);
  return Promise.resolve(screen);
});

const videoPlayerPlaySpy = vi.fn();
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

// Import App after mocks are set up
const AppModule = await import('../../src/App');

const { initApp, loadMainViewWrapper } = AppModule;

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

function videoScreensInDOM(): NodeListOf<Element> {
  const container = document.getElementById('screen-container');
  if (!container) throw new Error('#screen-container not found');
  return container.querySelectorAll('.video-screen');
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

describe('J3a: VideoScreen DOM/listener/timer leak on repeated play', () => {
  it('reuses the #screen-container without accumulating .video-screen elements after 2 plays', async () => {
    await loadMainViewWrapper();
    const actions = captureActions();

    // Play video 1 (selection plays directly now — no detail screen).
    await actions.onVideoSelect('v1', 'Video One');

    const screensAfterFirstPlay = videoScreensInDOM();
    expect(screensAfterFirstPlay.length).toBeGreaterThanOrEqual(1);

    // Play video 2.
    await actions.onVideoSelect('v2', 'Video Two');

    const screensAfterSecondPlay = videoScreensInDOM();

    // Only one .video-screen should exist after playing a second video.
    expect(
      screensAfterSecondPlay.length,
      'Only one .video-screen should exist in #screen-container after playing a second video'
    ).toBe(1);
  });

  it('calls cleanup() on the previous video screen before replacing it', async () => {
    await loadMainViewWrapper();
    const actions = captureActions();

    // Play video 1.
    await actions.onVideoSelect('v1', 'Video One');

    expect(createdVideoScreens.length).toBe(1);

    // Play video 2.
    await actions.onVideoSelect('v2', 'Video Two');

    // cleanup() must be called on the first video screen before replacement.
    expect(
      cleanupCalls.length,
      'cleanup() should be called on the previous video screen before replacement'
    ).toBeGreaterThanOrEqual(1);
  });

  it('removes the previous video screen element from the DOM', async () => {
    await loadMainViewWrapper();
    const actions = captureActions();

    // Play video 1.
    await actions.onVideoSelect('v1', 'Video One');

    const firstScreenEl = createdVideoScreens[0];
    expect(firstScreenEl.isConnected).toBe(true);

    // Play video 2.
    await actions.onVideoSelect('v2', 'Video Two');

    // The first video screen must be detached from the DOM.
    expect(
      firstScreenEl.isConnected,
      'The previous video screen element should be detached from the DOM'
    ).toBe(false);
  });
});
