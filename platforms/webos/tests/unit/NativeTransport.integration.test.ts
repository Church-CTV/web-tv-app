import { afterEach, expect, it, vi } from 'vitest';

const { player } = vi.hoisted(() => ({
  player: {
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isPlaying: () => true,
    seek: vi.fn(),
    getPosition: () => 4,
    getDuration: () => 100,
  },
}));
vi.mock('../../src/screenLoader', () => ({
  loadMainView: vi.fn(async () => {}),
  loadSettingsScreen: vi.fn(),
  loadSearchScreen: vi.fn(),
}));
vi.mock('../../src/modules/initStorage', () => ({
  createStorage: () => ({
    get: () => null,
    set: vi.fn(),
    remove: vi.fn(),
    getAll: () => ({}),
  }),
}));
vi.mock('../../src/modules/initVideoPlayer', () => ({ createVideoPlayer: () => player }));
vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: () => ({
    setOptOut: vi.fn(),
    trackInteraction: vi.fn(),
    shutdown: vi.fn(),
  }),
}));
vi.mock('../../src/Adapter/Analytics', () => ({ createAnalyticsExport: () => vi.fn() }));
vi.mock('../../src/ui/SplashScreen', () => ({ initSplashScreen: () => ({ dismiss: vi.fn() }) }));

afterEach(() => {
  window.dispatchEvent(new Event('beforeunload'));
});

it('routes hardware media and video Enter once through the booted app after reinitialization', async () => {
  document.body.innerHTML =
    '<div id="screen-grid" class="screen screen-active"></div><div id="screen-video" class="screen"><video id="video-player" tabindex="0"></video></div>';
  const app = await import('../../src/App');
  await app.initApp();
  await app.initApp();
  vi.clearAllMocks();
  const { showScreen } = await import('../../src/screens/visibility');
  showScreen('screen-video');
  const video = document.querySelector('video')!;
  video.focus();
  const send = (key: string, keyCode = 0, repeat = false) =>
    video.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        keyCode,
        repeat,
        bubbles: true,
        cancelable: true,
      })
    );
  send('MediaPlay');
  send('', 415);
  expect(player.resume).toHaveBeenCalledTimes(2);
  send('MediaPause');
  send('', 19);
  send('MediaPlayPause');
  send('', 10252);
  expect(player.pause).toHaveBeenCalledTimes(4);
  send('Enter');
  expect(player.pause).toHaveBeenCalledTimes(5);
  send('Enter', 13, true);
  expect(player.pause).toHaveBeenCalledTimes(5);
  send('MediaFastForward');
  send('', 412);
  expect(player.seek.mock.calls).toEqual([[14], [0]]);
  send('MediaStop');
  expect(player.stop).toHaveBeenCalledTimes(1);
  expect(document.getElementById('screen-grid')!.classList.contains('screen-active')).toBe(true);
  send('MediaPlay');
  expect(player.resume).toHaveBeenCalledTimes(2);
  showScreen('screen-video');
  window.dispatchEvent(new Event('beforeunload'));
  send('MediaPlay');
  expect(player.resume).toHaveBeenCalledTimes(2);
});
