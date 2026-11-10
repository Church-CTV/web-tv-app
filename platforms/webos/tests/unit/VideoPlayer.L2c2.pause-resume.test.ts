/**
 * L2c-2 — webOS pause()/resume() state transition consistency tests.
 *
 * Bugs to find:
 * 1. onPause handler unconditionally sets state and notifies even if state is
 *    already 'paused' → duplicate notifications when pause() called multiple times.
 * 2. stop() calls videoElement.pause() BEFORE setting state to 'idle'.
 *    The 'pause' event fires → onPause sets state to 'paused' and notifies.
 *    Then stop() overwrites to 'idle' → 'paused' then 'idle' sequence leaks out.
 * 3. resume() relies on async 'play' event for state change. If the event
 *    doesn't fire (or the promise rejects), state is never updated to 'playing'.
 *    The synchronous state update in pause() (bug 1) should match the
 *    pattern: set state directly in resume(), don't rely on async event alone.
 *
 * Contract: state consumers expect at most ONE notification per logical
 * state transition, in a consistent order.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('webOS VideoPlayer L2c-2: pause/resume state consistency', () => {
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
    videoElement.dispatchEvent(new Event('play'));
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

    videoElement.dispatchEvent(new Event('play'));
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
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    // Clear play to return a rejected promise (simulating jsdom)
    // so only the direct state update is tested
    const origPlay = videoElement.play;
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('not playing', 'InvalidStateError')),
      writable: false,
      configurable: true,
    });

    player.resume();

    // State must be 'playing' immediately after resume() returns
    // (regardless of whether the 'play' event fires)
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
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    // Resume again (state already 'playing')
    player.resume();
    videoElement.dispatchEvent(new Event('play'));

    const playingCount = states.filter((s) => s === 'playing').length;
    // Should only be 1 (from the first dispatch), not 2
    expect(playingCount).toBeLessThanOrEqual(1);
  });

  it('stop() from playing does not fire spurious paused notification', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    // Stop the player
    player.stop();

    // The 'pause' event (triggered internally by stop) should NOT cause
    // a 'paused' notification to leak out — state should transition to 'idle'
    const pausedCount = states.filter((s) => s === 'paused').length;
    const idleCount = states.filter((s) => s === 'idle').length;

    expect(idleCount).toBe(1);
    expect(pausedCount).toBe(0); // BUG: this is > 0 before fix
  });

  it('stop() in real-browser simulation: pause event during stop does not corrupt state', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));

    // Enter playing
    videoElement.dispatchEvent(new Event('play'));
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

    videoElement.dispatchEvent(new Event('play'));
    player.stop();
    expect(player.getState()).toBe('idle');

    videoElement.dispatchEvent(new Event('play'));
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
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.stop();

    // Immediately after stop() returns, state must be 'idle'
    expect(player.getState()).toBe('idle');

    // The notification sequence should be [idle] or [idle, something] —
    // NOT [paused, idle] (paused is spurious here)
    // The first non-idle entry should not be 'paused'
    const firstNotification = states[0];
    expect(firstNotification).not.toBe('paused');
  });
});
