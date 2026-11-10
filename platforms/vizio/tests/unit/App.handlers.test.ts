/**
 * Vizio App — handler + boot path tests.
 *
 * Covers:
 * - handleBackNavigation (analytics + nav pop)
 * - onVideoSelect via loadMainView (watch-later button, video error attach)
 * - screen loader wrapper delegation
 * - onFeedLoaded deep-link navigation
 * - attachVideoErrorHandlingLazy connect / detach / cleanup behavior
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadScheduleScreenSpy = vi.fn(() => Promise.resolve());
const loadContinueWatchingScreenSpy = vi.fn(() => Promise.resolve());
const loadWatchLaterScreenSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());

const trackInteractionSpy = vi.fn();
const videoPlayerPlaySpy = vi.fn();
const videoPlayerStopSpy = vi.fn();

vi.mock('../../src/screenLoader', () => ({
  loadMainView: loadMainViewSpy,
  loadScheduleScreen: loadScheduleScreenSpy,
  loadContinueWatchingScreen: loadContinueWatchingScreenSpy,
  loadWatchLaterScreen: loadWatchLaterScreenSpy,
  loadSettingsScreen: loadSettingsScreenSpy,
  loadSearchScreen: loadSearchScreenSpy,
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

// Import App AFTER mocks are set up
const AppModule = await import('../../src/App');

const {
  initApp,
  handleBackNavigation,
  handleWatchLater,
  loadMainViewWrapper,
  loadScheduleScreenWrapper,
  loadContinueWatchingScreenWrapper,
  loadWatchLaterScreenWrapper,
  loadSettingsScreenWrapper,
  loadSearchScreenWrapper,
} = AppModule;

function setScreenDOM() {
  document.body.innerHTML = `
    <div id="screen-container">
      <div id="screen-grid" class="screen screen-active">Grid</div>
      <div id="screen-search" class="screen">Search</div>
      <div id="screen-schedule" class="screen">Schedule</div>
      <div id="screen-continue-watching" class="screen">Continue</div>
      <div id="screen-watch-later" class="screen">Later</div>
      <div id="screen-settings" class="screen">Settings</div>
      <div id="screen-subscribe" class="screen">Subscribe</div>
      <div id="screen-video" class="screen" style="display:none">
        <video id="video-player"></video>
      </div>
    </div>
  `;
}

type FeedVideo = { videoId: string; title: string; streamUrl?: string };
type ScreenActions = {
  onVideoSelect: (videoId: string, title: string) => void;
  onSearch: () => Promise<void>;
  onSchedule: () => Promise<void>;
  onContinueWatching: () => Promise<void>;
  onWatchLater: () => Promise<void>;
  onSettings: () => Promise<void>;
  onRetry: () => Promise<void>;
  onFeedLoaded: (videos: FeedVideo[]) => void;
};

function captureActions(): ScreenActions {
  const calls = loadMainViewSpy.mock.calls as unknown[][];
  const call = calls[calls.length - 1];
  if (!call) throw new Error('loadMainView was not called');
  return call[2] as ScreenActions;
}

beforeAll(async () => {
  setScreenDOM();
  await initApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  setScreenDOM();
});

describe('Vizio App handlers', () => {
  describe('handleBackNavigation', () => {
    it('tracks the back interaction', () => {
      handleBackNavigation();
      expect(trackInteractionSpy).toHaveBeenCalledWith('back');
    });
  });

  describe('screen loader wrappers', () => {
    it('delegate to screenLoader', async () => {
      await loadMainViewWrapper();
      expect(loadMainViewSpy).toHaveBeenCalledTimes(1);
      await loadScheduleScreenWrapper();
      expect(loadScheduleScreenSpy).toHaveBeenCalledTimes(1);
      await loadContinueWatchingScreenWrapper();
      expect(loadContinueWatchingScreenSpy).toHaveBeenCalledTimes(1);
      await loadWatchLaterScreenWrapper();
      expect(loadWatchLaterScreenSpy).toHaveBeenCalledTimes(1);
      await loadSettingsScreenWrapper();
      expect(loadSettingsScreenSpy).toHaveBeenCalledTimes(1);
      await loadSearchScreenWrapper();
      expect(loadSearchScreenSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('home actions map', () => {
    it('onSearch loads search and shows it', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      await actions.onSearch();
      expect(loadSearchScreenSpy).toHaveBeenCalled();
      expect(document.getElementById('screen-search')?.className).toContain('screen-active');
    });

    it.each(['onSchedule', 'onContinueWatching', 'onWatchLater'])(
      'omits disabled Roku action %s',
      async (action) => {
        await loadMainViewWrapper();
        expect(captureActions()).not.toHaveProperty(action);
      }
    );

    it('onSettings loads and shows the screen', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      await actions.onSettings();
      expect(loadSettingsScreenSpy).toHaveBeenCalled();
      expect(document.getElementById('screen-settings')?.className).toContain('screen-active');
    });

    it('onRetry reloads the main view', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      vi.clearAllMocks();
      await actions.onRetry();
      expect(loadMainViewSpy).toHaveBeenCalledTimes(1);
    });

    it('onFeedLoaded stores videos used by the search wrapper', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([{ videoId: 'v9', title: 'Nine' }]);
      vi.clearAllMocks();
      await loadSearchScreenWrapper();
      const call = (loadSearchScreenSpy.mock.calls as unknown[][])[0];
      expect(call[0]).toEqual([{ videoId: 'v9', title: 'Nine' }]);
    });

    it('onVideoSelect plays the stream without exposing the disabled Roku watch-later feature', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'v7', title: 'Seven', streamUrl: 'https://media.example/seven.m3u8' },
      ]);
      actions.onVideoSelect('v7', 'Seven');
      expect(videoPlayerPlaySpy).toHaveBeenCalledWith('https://media.example/seven.m3u8');
      expect(document.getElementById('btn-watch-later-video')).toBeNull();
      expect(document.getElementById('screen-video')?.className).toContain('screen-active');
    });
  });

  it('focuses a loaded Settings control and ignores late focus after Back', async () => {
    await initApp();
    const actions = captureActions();
    loadSettingsScreenSpy.mockImplementationOnce(async () => {
      document.getElementById('screen-settings')!.innerHTML = '<button>Setting</button>';
    });
    await actions.onSettings();
    expect(document.activeElement).toBe(document.querySelector('#screen-settings button'));
    handleBackNavigation();
    let finish!: () => void;
    loadSettingsScreenSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const pending = actions.onSettings();
    handleBackNavigation();
    finish();
    await pending;
    expect(document.getElementById('screen-grid')!.classList.contains('screen-active')).toBe(true);
    expect(document.activeElement).not.toBe(document.querySelector('#screen-settings button'));
  });

  it('returns from Search and Settings to the triggering control', async () => {
    await initApp();
    const actions = captureActions();
    const button = document.createElement('button');
    document.getElementById('screen-grid')!.appendChild(button);
    for (const open of [actions.onSearch, actions.onSettings]) {
      button.focus();
      await open();
      handleBackNavigation();
      expect(document.getElementById('screen-grid')!.classList.contains('screen-active')).toBe(
        true
      );
      expect(document.activeElement).toBe(button);
    }
  });

  it('reports a missing stream without starting fabricated playback', async () => {
    await loadMainViewWrapper();
    captureActions().onVideoSelect('missing', 'Missing');
    expect(videoPlayerPlaySpy).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('stream');
  });

  it('wires remote row navigation and activates Enter once', async () => {
    await initApp();
    document.getElementById('screen-grid')!.innerHTML =
      `<div id="left-nav"><button>Home</button></div><div class="content-category__row"><div tabindex="0" data-video-id="a"></div><div tabindex="0" data-video-id="b"></div></div><div class="content-category__row"><div tabindex="0" data-video-id="c"></div></div>`;
    const cards = document.querySelectorAll<HTMLElement>('[data-video-id]');
    const click = vi.fn();
    cards[2].addEventListener('click', click);
    cards[1].focus();
    cards[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(cards[2]);
    cards[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    expect(click).toHaveBeenCalledTimes(1);
    cards[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(document.querySelector('#left-nav button'));
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(cards[0]);
  });

  it('does not attach late video error listeners after Back', async () => {
    await initApp();
    const actions = captureActions();
    actions.onFeedLoaded([
      { videoId: 'late', title: 'Late', streamUrl: 'https://media.example/late.mp4' },
    ]);
    actions.onVideoSelect('late', 'Late');
    handleBackNavigation();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.getElementById('video-player')!.dispatchEvent(new Event('stalled'));
    expect(document.querySelector('.video-buffering')).toBeNull();
    expect(document.getElementById('screen-grid')!.classList.contains('screen-active')).toBe(true);
  });

  describe('handleWatchLater', () => {
    it('tracks the watch_later interaction', () => {
      handleWatchLater('v8', 'Eight');
      expect(trackInteractionSpy).toHaveBeenCalledWith('watch_later', 'content-card', 'v8');
    });
  });

  describe('video error handling on selection', () => {
    it('attaches error handling to the video element when a selection happens', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'v1', title: 'One', streamUrl: 'https://media.example/v1.mp4' },
      ]);
      actions.onVideoSelect('v1', 'One');
      await new Promise((r) => setTimeout(r, 0));
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      // Wait for the lazy dynamic import to resolve and attach the listener.
      await vi.waitFor(() => {
        videoEl.dispatchEvent(new Event('error'));
        expect(document.querySelector('.error-dialog-container')).not.toBeNull();
      });
    });

    it('cleans up a prior error overlay when a new selection happens', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'a', title: 'A', streamUrl: 'https://media.example/a.mp4' },
      ]);
      actions.onVideoSelect('a', 'A');
      await new Promise((r) => setTimeout(r, 0));
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      // Wait for the listener to attach, then trigger a dialog.
      await vi.waitFor(() => {
        videoEl.dispatchEvent(new Event('error'));
        expect(document.querySelectorAll('.error-dialog-container').length).toBeGreaterThanOrEqual(
          1
        );
      });
      // Selecting again must remove the previous overlay and leave at most one.
      actions.onFeedLoaded([
        { videoId: 'b', title: 'B', streamUrl: 'https://media.example/b.mp4' },
      ]);
      actions.onVideoSelect('b', 'B');
      await new Promise((r) => setTimeout(r, 0));
      expect(document.querySelectorAll('.error-dialog-container').length).toBeLessThanOrEqual(1);
    });

    it('skips attaching the dialog when the video element was detached during lazy load', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'c', title: 'C', streamUrl: 'https://media.example/c.mp4' },
      ]);
      actions.onVideoSelect('c', 'C');
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      videoEl.remove();
      await new Promise((r) => setTimeout(r, 0));
      expect(document.querySelector('.error-dialog-container')).toBeNull();
    });
  });

  // F140: back-out must tear the video screen down, not just hide it. Certifying
  // stop()/cleanup on the adapter or the renderer alone left this wiring untested.
  describe('back out of the video screen', () => {
    it('stops playback so audio and buffering do not continue on the grid', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'd', title: 'D', streamUrl: 'https://media.example/d.mp4' },
      ]);
      actions.onVideoSelect('d', 'D');
      await vi.waitFor(() =>
        expect(document.getElementById('screen-video')?.className).toContain('screen-active')
      );
      handleBackNavigation();
      expect(videoPlayerStopSpy).toHaveBeenCalledTimes(1);
    });

    it('removes the buffering row and detaches its media listeners', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onFeedLoaded([
        { videoId: 'e', title: 'E', streamUrl: 'https://media.example/e.mp4' },
      ]);
      actions.onVideoSelect('e', 'E');
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      await vi.waitFor(() => {
        videoEl.dispatchEvent(new Event('stalled'));
        expect(document.querySelector('.video-buffering')).not.toBeNull();
      });
      handleBackNavigation();
      expect(document.querySelector('.video-buffering')).toBeNull();
      // A late media event after teardown must not resurrect the row.
      videoEl.dispatchEvent(new Event('stalled'));
      expect(document.querySelector('.video-buffering')).toBeNull();
    });
  });
});
