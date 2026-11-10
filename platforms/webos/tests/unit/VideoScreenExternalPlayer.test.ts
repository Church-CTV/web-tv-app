/**
 * VideoScreen External Player Integration — verifies that VideoScreen
 * uses an externally provided VideoPlayer instead of creating its own.
 * This prevents the duplicate-player bug (Pitfall 3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen, type VideoScreenProps } from '../../src/ui/VideoScreen';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';
import { createStorageAdapter } from '../../src/Adapter/Storage';

describe('VideoScreen External Player Integration', () => {
  let container: HTMLDivElement;
  let storage: ReturnType<typeof createStorageAdapter>;
  let videoEl: HTMLVideoElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
    storage = createStorageAdapter();

    // Create a real video element for the external player
    videoEl = document.createElement('video');
    videoEl.id = 'video-player';
    document.body.appendChild(videoEl);

    // Mock play/pause so they don't actually operate
    vi.spyOn(videoEl, 'play').mockResolvedValue(undefined as never);
    vi.spyOn(videoEl, 'pause').mockImplementation(() => {});
    Object.defineProperty(videoEl, 'currentTime', {
      get: () => 15,
      set: vi.fn(),
      configurable: true,
    });
    Object.defineProperty(videoEl, 'duration', {
      get: () => 120,
      configurable: true,
    });
  });

  it('saves position using the external player, not an internal one', () => {
    const externalPlayer = createVideoPlayer(videoEl);
    const getPositionSpy = vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(15);

    // Create screen with external player
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    // Simulate video ended event — should trigger saveCurrentPosition
    const screenVideo = screen.querySelector('video') as HTMLVideoElement;
    expect(screenVideo).toBeTruthy();
    screenVideo.dispatchEvent(new Event('ended'));

    // The external player's getPosition MUST be called
    // If VideoScreen creates its own player internally, this fails
    expect(getPositionSpy).toHaveBeenCalled();
  });

  it('uses external player for progress updates on timeupdate', () => {
    const externalPlayer = createVideoPlayer(videoEl);
    const getPositionSpy = vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(30);
    const getDurationSpy = vi.spyOn(externalPlayer, 'getDuration').mockReturnValue(120);

    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    const screenVideo = screen.querySelector('video') as HTMLVideoElement;
    screenVideo.dispatchEvent(new Event('timeupdate'));

    // External player must be used for progress calculations
    expect(getPositionSpy).toHaveBeenCalled();
    expect(getDurationSpy).toHaveBeenCalled();
  });

  it('saves position on back button click using external player', () => {
    const externalPlayer = createVideoPlayer(videoEl);
    const getPositionSpy = vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(45);

    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      onBack: () => {},
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    const backBtn = screen.querySelector('[data-action="back"]') as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    backBtn.click();

    expect(getPositionSpy).toHaveBeenCalled();
  });
  it('clamps the progress fill when a stored resume point exceeds the duration', () => {
    // A corrupt Continue Watching entry (position > duration) wrote a width above
    // 100%, so the bar overflowed its track and aria-valuenow ran past valuemax.
    const externalPlayer = createVideoPlayer(videoEl);
    vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(300);
    vi.spyOn(externalPlayer, 'getDuration').mockReturnValue(120);

    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    (screen.querySelector('video') as HTMLVideoElement).dispatchEvent(new Event('timeupdate'));

    const bar = screen.querySelector('.video-screen__progress') as HTMLElement;
    expect((bar.querySelector('.video-screen__progress-bar') as HTMLElement).style.width).toBe(
      '100%'
    );
    expect(bar.getAttribute('aria-valuenow')).toBe('120');
  });

  it('never lets the progress fill go negative', () => {
    const externalPlayer = createVideoPlayer(videoEl);
    vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(-5);
    vi.spyOn(externalPlayer, 'getDuration').mockReturnValue(120);

    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    (screen.querySelector('video') as HTMLVideoElement).dispatchEvent(new Event('timeupdate'));

    const bar = screen.querySelector('.video-screen__progress') as HTMLElement;
    expect((bar.querySelector('.video-screen__progress-bar') as HTMLElement).style.width).toBe(
      '0%'
    );
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('reports aria-valuenow in the same unit as aria-valuemax (seconds)', () => {
    // aria-valuemax is authored from the duration in seconds, so a valuenow written
    // as a percentage tells a screen reader "25 of 120" for a video that is 25%
    // through 50 seconds. Both attributes must share one unit to be intelligible.
    const externalPlayer = createVideoPlayer(videoEl);
    vi.spyOn(externalPlayer, 'getPosition').mockReturnValue(60);
    vi.spyOn(externalPlayer, 'getDuration').mockReturnValue(120);

    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      player: externalPlayer,
      storage: storage,
    } as VideoScreenProps);

    (screen.querySelector('video') as HTMLVideoElement).dispatchEvent(new Event('timeupdate'));

    const bar = screen.querySelector('.video-screen__progress') as HTMLElement;
    expect((bar.querySelector('.video-screen__progress-bar') as HTMLElement).style.width).toBe(
      '50%'
    );
    expect(bar.getAttribute('aria-valuenow')).toBe('60');
  });
  it('does not seek a live stream with an unknown duration', () => {
    const player = createVideoPlayer(videoEl);
    vi.spyOn(player, 'getDuration').mockReturnValue(Infinity);
    const seek = vi.spyOn(player, 'seek');
    const screen = createVideoScreen({
      videoId: 'live',
      title: 'Live',
      streamUrl: '/live.m3u8',
      player,
      storage,
    } as VideoScreenProps);
    const track = screen.querySelector('.video-screen__progress') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
    track.dispatchEvent(new MouseEvent('click', { clientX: 50 }));
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(seek).not.toHaveBeenCalled();
  });
});
