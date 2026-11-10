/**
 * L2c-2 — Tizen pause()/resume() state transition consistency tests.
 *
 * Same contract as webOS L2c-2, applied to Tizen VideoPlayer adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Tizen VideoPlayer L2c-2: pause/resume state consistency', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    player = createVideoPlayer(videoElement);
  });

  it('pause() from playing sets state to paused and notifies once', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    player.pause();
    videoElement.dispatchEvent(new Event('pause'));

    expect(player.getState()).toBe('paused');
    const pausedCount = states.filter((s) => s === 'paused').length;
    expect(pausedCount).toBe(1);
  });

  it('pause() called twice does not duplicate paused notifications', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    // First pause
    player.pause();
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    // Second pause (state already 'paused')
    player.pause();
    videoElement.dispatchEvent(new Event('pause'));

    const pausedCount = states.filter((s) => s === 'paused').length;
    expect(pausedCount).toBe(1);
  });

  it('resume() sets state to playing synchronously (no reliance on async event)', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter paused state
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    // Clear play to return a rejected promise
    const origPlay = videoElement.play;
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('not playing', 'InvalidStateError')),
      writable: false,
      configurable: true,
    });

    player.resume();

    // State must be 'playing' immediately after resume() returns
    expect(player.getState()).toBe('playing');

    // Restore
    Object.defineProperty(videoElement, 'play', {
      value: origPlay,
      writable: true,
      configurable: true,
    });
  });

  it('resume() from playing does not duplicate playing notifications', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    // Resume again (state already 'playing')
    player.resume();
    videoElement.dispatchEvent(new Event('playing'));

    const playingCount = states.filter((s) => s === 'playing').length;
    expect(playingCount).toBeLessThanOrEqual(1);
  });

  it('stop() from playing does not fire spurious paused notification', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    player.stop();

    const pausedCount = states.filter((s) => s === 'paused').length;
    const idleCount = states.filter((s) => s === 'idle').length;

    expect(idleCount).toBe(1);
    expect(pausedCount).toBe(0); // BUG: this is > 0 before fix
  });

  it('stop() in real-browser simulation: pause event during stop does not corrupt state', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    // Simulate real-browser behavior: 'pause' event fires synchronously
    // inside videoElement.pause() called by stop().
    const origPause = videoElement.pause;
    Object.defineProperty(videoElement, 'pause', {
      value: function () {
        (this as HTMLVideoElement).dispatchEvent(new Event('pause'));
        return origPause.call(this);
      },
      writable: false,
      configurable: true,
    });

    player.stop();

    expect(player.getState()).toBe('idle');

    const idleCount = states.filter((s) => s === 'idle').length;
    const pausedCount = states.filter((s) => s === 'paused').length;
    expect(idleCount).toBe(1);
    expect(pausedCount).toBe(0);

    Object.defineProperty(videoElement, 'pause', {
      value: origPause,
      writable: true,
      configurable: true,
    });
  });

  it('pause() after stop() works correctly (flag is reset)', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    videoElement.dispatchEvent(new Event('playing'));
    player.stop();
    expect(player.getState()).toBe('idle');

    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    player.pause();
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    const pausedCount = states.filter((s) => s === 'paused').length;
    expect(pausedCount).toBe(1);
  });

  it('stop() sets state to idle synchronously before any event dispatch', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    player.stop();

    expect(player.getState()).toBe('idle');

    const firstNotification = states[0];
    expect(firstNotification).not.toBe('paused');
  });
});
