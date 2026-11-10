/**
 * L2c-1 — Seek recovery from error state (TDD RED).
 *
 * Parity test for Vizio platform.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Vizio VideoPlayer L2c-1: seek recovery from error', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    player = createVideoPlayer(videoElement);
  });

  it('seeking from error state transitions to buffering', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    player.seek(30);

    expect(player.getState()).toBe('buffering');
  });

  it('seeking from error notifies state subscribers', () => {
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    player.seek(30);

    expect(states).toContain('buffering');
  });

  it('seeking from error can recover to playing on canplay event', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    player.seek(30);
    expect(player.getState()).toBe('buffering');

    // Vizio uses 'playing' event as recovery signal
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');
    expect(player.isPlaying()).toBe(true);
  });

  it('seeking during error does not prevent normal playback', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    player.seek(45);

    // Vizio uses 'playing' event (HTML5 spec) for playing state
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');
  });

  it('isPlaying returns false while seeking from error', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    player.seek(15);

    expect(player.isPlaying()).toBe(false);
  });
});
