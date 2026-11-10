/**
 * The Tizen player must drive the Samsung screensaver from playback state (MF-04/MF-05).
 * These tests pin the policy at the state choke point, so any new state path inherits it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

type Calls = number[];

function installFakeWebApis(calls: Calls): void {
  (window as unknown as { webapis: unknown }).webapis = {
    appcommon: {
      SCREEN_SAVER_OFF: 0,
      SCREEN_SAVER_ON: 1,
      setScreenSaver: (state: number) => {
        calls.push(state);
      },
    },
  };
}

describe('Tizen VideoPlayer screensaver policy', () => {
  let calls: Calls;
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    calls = [];
    installFakeWebApis(calls);
    videoElement = document.createElement('video');
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.resolve(),
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as unknown as { webapis?: unknown }).webapis;
  });

  it('disables the screensaver when playback starts', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.dispatchEvent(new Event('playing'));
    expect(calls).toEqual([0]);
    player.stop();
  });

  it('re-enables the screensaver on pause', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('pause'));
    expect(calls).toEqual([0, 1]);
    player.stop();
  });

  it('re-enables the screensaver on stop and on error and on ended', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.dispatchEvent(new Event('playing'));
    player.stop();
    expect(calls[calls.length - 1]).toBe(1);
    calls.length = 0;
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('error'));
    expect(calls[calls.length - 1]).toBe(1);
    calls.length = 0;
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('ended'));
    expect(calls[calls.length - 1]).toBe(1);
  });

  it('keeps the screensaver off while the player is buffering', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('waiting'));
    expect(calls).toEqual([0]);
    player.stop();
  });

  it('does not throw when the platform API is absent (browser, CI)', () => {
    delete (window as unknown as { webapis?: unknown }).webapis;
    const player = createVideoPlayer(videoElement);
    expect(() => {
      videoElement.dispatchEvent(new Event('playing'));
      videoElement.dispatchEvent(new Event('pause'));
    }).not.toThrow();
    player.stop();
  });
});
