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

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadMainViewSpy = vi.fn(() => Promise.resolve());
const loadSettingsScreenSpy = vi.fn(() => Promise.resolve());
const loadSearchScreenSpy = vi.fn(() => Promise.resolve());

const trackInteractionSpy = vi.fn();
const videoPlayerPlaySpy = vi.fn();
const videoPlayerStopSpy = vi.fn();

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

const App = await import('../../src/App');
const { initLeftNav, renderLeftNav } = await import('../../src/ui/LeftNav');
const { loadSearchScreen } = await import('../../src/screens/SearchScreen');
const { initContentGrid } = await import('../../src/ui/ContentGrid');
const { attachVideoErrorHandling } = await import('@ctv/shared/ui/VideoErrorRenderer');

function enter(el: HTMLElement): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

beforeEach(async () => {
  App.remoteControl?.destroy();
  document.body.innerHTML = `<nav id="left-nav"></nav><div id="screen-grid" class="screen screen-active"></div><div id="screen-search" class="screen"></div><div id="screen-video" class="screen"><video id="video-player"></video></div>`;
  await App.initApp();
  vi.clearAllMocks();
});

describe('real remote adapter Enter activation', () => {
  it('opens sidebar Search exactly once', () => {
    const items = [{ id: 'search', label: 'Search', icon: 'search', screen: 'search' }];
    const onSearch = vi.fn();
    document.getElementById('left-nav')!.innerHTML = renderLeftNav({
      items,
      onItemClick: onSearch,
    });
    initLeftNav(items, undefined, onSearch);
    enter(document.querySelector('button')!);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('types one on-screen search key', async () => {
    await loadSearchScreen([], vi.fn());
    enter(document.querySelector('.osk-key[data-key="q"]')!);
    expect(document.getElementById('search-query')!.textContent).toBe('q');
  });

  it.each(['feed', 'video'])('clicks %s Retry exactly once', (screen) => {
    const button = document.createElement('button');
    button.textContent = 'Retry';
    document.getElementById(screen === 'feed' ? 'screen-grid' : 'screen-video')!.append(button);
    const retry = vi.fn();
    button.addEventListener('click', retry);
    enter(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('retries actual video playback once through the error dialog', async () => {
    const video = document.getElementById('video-player') as HTMLVideoElement;
    vi.spyOn(video, 'pause').mockImplementation(() => {});
    const play = vi.spyOn(video, 'play').mockResolvedValue();
    const cleanup = attachVideoErrorHandling(video);
    video.dispatchEvent(new Event('error'));
    enter(document.querySelector('.error-dialog__button')!);
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    cleanup();
  });

  it('activates a button once through the hardware key-lock callback', async () => {
    App.remoteControl?.destroy();
    const callbacks = new Map<string, () => void>();
    window.tizen = {
      keys: {
        registerlockevent: (key, callback) => {
          callbacks.set(key, callback);
        },
      },
    };
    try {
      await App.initApp();
      const button = document.createElement('button');
      document.getElementById('screen-grid')!.append(button);
      const click = vi.fn();
      button.addEventListener('click', click);
      button.focus();
      callbacks.get('KEY_ENTER')!();
      expect(click).toHaveBeenCalledTimes(1);
    } finally {
      App.remoteControl?.destroy();
      delete window.tizen;
    }
  });

  it('lets the grid select exactly once', () => {
    const grid = document.getElementById('screen-grid') as HTMLDivElement;
    grid.innerHTML =
      '<div class="content-category__row"><div data-video-id="one" tabindex="0">One</div></div>';
    const select = vi.fn();
    initContentGrid(grid, select);
    enter(grid.querySelector('[data-video-id]')!);
    expect(select).toHaveBeenCalledTimes(1);
    expect(videoPlayerPlaySpy).not.toHaveBeenCalled();
  });

  it('respects a custom Enter handler without clicking again', () => {
    const button = document.createElement('button');
    document.getElementById('screen-grid')!.append(button);
    const activate = vi.fn();
    button.addEventListener('click', activate);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        activate();
      }
    });
    enter(button);
    expect(activate).toHaveBeenCalledTimes(1);
  });
});

describe('real remote Search keyboard navigation', () => {
  it.each(['DOM', 'native'])('moves through logical rows and clamps via %s', async (delivery) => {
    App.remoteControl?.destroy();
    const callbacks = new Map<string, () => void>();
    window.tizen = { keys: { registerlockevent: (key, callback) => callbacks.set(key, callback) } };
    try {
      await App.initApp();
      await loadSearchScreen([], vi.fn());
      const key = (name: string) =>
        document.querySelector<HTMLButtonElement>(`.osk-key[data-key="${name}"]`)!;
      const send = (direction: string) => {
        if (delivery === 'native') callbacks.get(`KEY_${direction.toUpperCase()}`)!();
        else
          document.activeElement!.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: `Arrow${direction}`,
              bubbles: true,
              cancelable: true,
            })
          );
      };
      key('p').focus();
      send('Down');
      expect(document.activeElement).toBe(key('l'));
      send('Down');
      expect(document.activeElement).toBe(key('m'));
      send('Down');
      expect(document.activeElement).toBe(key('clear'));
      send('Left');
      expect(document.activeElement).toBe(key('back'));
      send('Up');
      expect(document.activeElement).toBe(key('x'));
      key('1').focus();
      send('Up');
      expect(document.activeElement).toBe(key('1'));
    } finally {
      App.remoteControl?.destroy();
      delete window.tizen;
    }
  });
});
