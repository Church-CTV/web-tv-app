/**
 * Tizen App — handler + boot path tests.
 *
 * Covers:
 * - handleBackNavigation (analytics + back-to-grid)
 * - handleSelection via onVideoSelect (video error attach)
 * - screen loader wrapper delegation (main-view / settings / search)
 * - onFeedLoaded deep-link navigation
 * - initApp remote-control wiring (G: D-pad keys must drive the app)
 * - attachVideoErrorHandlingLazy cleanup behavior
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());

const trackInteractionSpy = vi.fn();
const videoPlayerPlaySpy = vi.fn();
const videoPlayerStopSpy = vi.fn();
const createRemoteControlSpy = vi.fn(() => ({ destroy: vi.fn() }));

vi.mock('../../src/screenLoader', () => ({
  loadMainView: loadMainViewSpy,
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
vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: createRemoteControlSpy,
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
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: vi.fn(() => ({ dismiss: vi.fn() })),
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
    <div id="screen-container">
      <div id="screen-grid" class="screen screen-active">Grid</div>
      <div id="screen-search" class="screen">Search</div>
      <div id="screen-settings" class="screen">Settings</div>
      <div id="screen-video" class="screen" style="display:none">
        <video id="video-player"></video>
      </div>
    </div>
  `;
}

type FeedVideo = { videoId: string; title: string };
type ScreenActions = {
  onVideoSelect: (videoId: string, title: string) => void;
  onSearch: () => Promise<void>;
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

function lastRemoteControlEvents(): Record<string, () => void> {
  const calls = createRemoteControlSpy.mock.calls as unknown[][];
  const call = calls[calls.length - 1];
  if (!call) throw new Error('createRemoteControl was not called');
  return call[0] as Record<string, () => void>;
}

beforeAll(async () => {
  setScreenDOM();
  await initApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  setScreenDOM();
});

describe('Tizen App handlers', () => {
  describe('initApp remote-control wiring', () => {
    beforeEach(async () => {
      // Re-run boot after clearAllMocks so the spy records this run's call.
      await initApp();
    });

    it('creates the remote control during boot', () => {
      expect(createRemoteControlSpy).toHaveBeenCalled();
    });

    it('onBack drives handleBackNavigation and tracks analytics', () => {
      const events = lastRemoteControlEvents();
      const before = trackInteractionSpy.mock.calls.length;
      events.onBack();
      expect(trackInteractionSpy.mock.calls.length).toBeGreaterThan(before);
      expect(trackInteractionSpy).toHaveBeenCalledWith('back');
    });

    it('onEnter selects the focused video card', () => {
      const events = lastRemoteControlEvents();
      const card = document.createElement('div');
      card.setAttribute('data-video-id', 'v42');
      card.textContent = 'Focused Video';
      document.body.appendChild(card);
      card.setAttribute('tabindex', '0');
      (card as HTMLElement).focus();

      events.onEnter();

      expect(videoPlayerPlaySpy).toHaveBeenCalledWith('/stream/v42.mp4');
    });

    it('onEnter with no focused video does nothing harmful', () => {
      const events = lastRemoteControlEvents();
      const playBefore = videoPlayerPlaySpy.mock.calls.length;
      events.onEnter();
      expect(videoPlayerPlaySpy.mock.calls.length).toBe(playBefore);
    });

    it('onEnter with a focused element lacking data-video-id is a no-op', () => {
      const events = lastRemoteControlEvents();
      const plain = document.createElement('div');
      plain.textContent = 'No id here';
      plain.setAttribute('tabindex', '0');
      document.body.appendChild(plain);
      plain.focus();
      const playBefore = videoPlayerPlaySpy.mock.calls.length;
      events.onEnter();
      expect(videoPlayerPlaySpy.mock.calls.length).toBe(playBefore);
    });

    it('onUp/onDown/onLeft/onRight are defined no-ops', () => {
      const events = lastRemoteControlEvents();
      for (const key of ['onUp', 'onDown', 'onLeft', 'onRight']) {
        expect(typeof events[key]).toBe('function');
        expect(() => events[key]()).not.toThrow();
      }
    });
  });

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
      await loadSettingsScreenWrapper();
      expect(loadSettingsScreenSpy).toHaveBeenCalledTimes(1);
      await loadSearchScreenWrapper();
      expect(loadSearchScreenSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('home actions map', () => {
    it('onSearch shows the screen before focusing the first visible keyboard key', async () => {
      document.getElementById('screen-search')!.innerHTML =
        '<input id="search-input" hidden><button class="osk-key" data-key="1">1</button>';
      await loadMainViewWrapper();
      const actions = captureActions();
      await actions.onSearch();
      expect(loadSearchScreenSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(document.querySelector('.osk-key'));
      expect(document.getElementById('screen-search')?.className).toContain('screen-active');
    });

    it('onSettings shows the screen and focuses its Give action', async () => {
      document.getElementById('screen-settings')!.innerHTML =
        '<a class="settings-give__link" href="https://example.com">Give</a>';
      await loadMainViewWrapper();
      const actions = captureActions();
      await actions.onSettings();
      expect(loadSettingsScreenSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(document.querySelector('.settings-give__link'));
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

    it('onVideoSelect plays the stream and shows the video screen', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onVideoSelect('v7', 'Seven');
      expect(videoPlayerPlaySpy).toHaveBeenCalledWith('/stream/v7.mp4');
      expect(document.getElementById('screen-video')?.className).toContain('screen-active');
    });
  });

  describe('video error handling on selection', () => {
    it('does not attach after immediate Back during lazy loading', async () => {
      await loadMainViewWrapper();
      captureActions().onVideoSelect('late', 'Late');
      handleBackNavigation();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const video = document.getElementById('video-player')!;
      video.dispatchEvent(new Event('error'));
      expect(document.querySelector('.video-buffering')).toBeNull();
      expect(document.querySelector('.error-dialog-container')).toBeNull();
    });

    it('renders an initial error that occurred before the lazy renderer attached', async () => {
      await loadMainViewWrapper();
      const video = document.getElementById('video-player') as HTMLVideoElement;
      Object.defineProperty(video, 'error', { configurable: true, value: { code: 2 } });
      captureActions().onVideoSelect('early', 'Early');
      video.dispatchEvent(new Event('error'));
      await vi.waitFor(() =>
        expect(document.querySelector('.error-dialog-container')).not.toBeNull()
      );
    });

    it('attaches error handling to the video element when a selection happens', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onVideoSelect('v1', 'One');
      // Let the lazy dynamic import resolve and attach the listener.
      await new Promise((r) => setTimeout(r, 0));
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      // Wait for the lazy dynamic import to resolve and attach the listener,
      // then dispatch a media error which turns into a dialog.
      await vi.waitFor(() => {
        videoEl.dispatchEvent(new Event('error'));
        expect(document.querySelector('.error-dialog-container')).not.toBeNull();
      });
    });

    it('cleans up a prior error overlay when a new selection happens', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
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
      actions.onVideoSelect('b', 'B');
      await new Promise((r) => setTimeout(r, 0));
      expect(document.querySelectorAll('.error-dialog-container').length).toBeLessThanOrEqual(1);
    });

    it('skips attaching the dialog when the video element was detached during lazy load', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
      actions.onVideoSelect('c', 'C');
      // Detach the video element before the dynamic import resolves.
      const videoEl = document.getElementById('video-player') as HTMLVideoElement;
      videoEl.remove();
      await new Promise((r) => setTimeout(r, 0));
      // The renderer must bail without throwing on the detached element.
      expect(document.querySelector('.error-dialog-container')).toBeNull();
    });
  });

  // F140: back-out must tear the video screen down, not just hide it. Certifying
  // stop()/cleanup on the adapter or the renderer alone left this wiring untested.
  describe('back out of the video screen', () => {
    it('stops playback when leaving the video screen', async () => {
      await loadMainViewWrapper();
      const actions = captureActions();
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

describe('handleBackNavigation at root (Tizen exit)', () => {
  it('exits the application via tizen when back is pressed on the home grid', () => {
    setScreenDOM(); // screen-grid is the active (root) screen
    const exitSpy = vi.fn();
    window.tizen = {
      application: { getCurrentApplication: () => ({ exit: exitSpy }) },
    };
    handleBackNavigation();
    expect(exitSpy).toHaveBeenCalledTimes(1);
    delete window.tizen;
  });

  it('does not exit when a non-home screen is active', () => {
    setScreenDOM();
    document.getElementById('screen-grid')!.classList.remove('screen-active');
    document.getElementById('screen-search')!.classList.add('screen-active');
    const exitSpy = vi.fn();
    window.tizen = {
      application: { getCurrentApplication: () => ({ exit: exitSpy }) },
    };
    handleBackNavigation();
    expect(exitSpy).not.toHaveBeenCalled();
    delete window.tizen;
  });
});
