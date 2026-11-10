/**
 * L2b-4 — Vizio stop() notification parity tests.
 *
 * Parity gap: webOS L2b-3 added an `if (currentState !== 'idle')` guard to
 * `stop()` to prevent double-notification. Vizio's `stop()` still
 * unconditionally sets `currentState = 'idle'` and calls `notifyState('idle')`,
 * so calling `stop()` twice fires `idle` twice. This breaks state consumers
 * (analytics, cross-platform contract code) that expect at most one transition.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Vizio VideoPlayer L2b-4: stop() notification parity', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('stop() notifies state change subscribers with idle (from playing)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to playing
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');

    // Call stop
    player.stop();

    expect(states).toContain('idle');
    expect(player.getState()).toBe('idle');
  });

  it('stop() from initial idle does not double-notify idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Call stop from initial idle state
    player.stop();

    // Should only notify idle at most once
    const idleCount = states.filter((s) => s === 'idle').length;
    expect(idleCount).toBeLessThanOrEqual(1);
  });

  it('stop() after stop() does not double-notify idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // First: transition to playing then stop
    videoElement.dispatchEvent(new Event('playing'));
    player.stop();
    const idleCountAfterFirstStop = states.filter((s) => s === 'idle').length;
    expect(idleCountAfterFirstStop).toBe(1);

    // Second stop() should not add another idle notification
    player.stop();
    const idleCountAfterSecondStop = states.filter((s) => s === 'idle').length;

    expect(idleCountAfterSecondStop).toBe(idleCountAfterFirstStop);
  });

  it('stop() from buffering state notifies idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to buffering via stalled
    videoElement.dispatchEvent(new Event('stalled'));
    expect(player.getState()).toBe('buffering');

    player.stop();

    expect(states).toContain('idle');
    expect(player.getState()).toBe('idle');
  });

  it('stop() from error state notifies idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to error
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    player.stop();

    expect(states).toContain('idle');
    expect(player.getState()).toBe('idle');
  });

  it('stop() pauses the video element', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.dispatchEvent(new Event('playing'));

    player.stop();

    expect(videoElement.paused).toBe(true);
  });
});
