/**
 * L2b-3 — stop() notification parity tests.
 * RED: These tests prove the parity bug before the fix.
 *
 * Parity gap: Tizen/Vizio both call `notifyState('idle')` inside `stop()`,
 * but webOS's `stop()` does not. This means webOS state subscribers never
 * learn that playback has stopped — analytics, UI consumers, and any
 * cross-platform contract code relying on state changes are broken.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('webOS VideoPlayer L2b-3: stop() notification parity', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('stop() notifies state change subscribers with idle (parity bug)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to playing
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    // Call stop
    player.stop();

    // Tizen/Vizio both notify 'idle' on stop(); webOS does not (missing parity)
    expect(states).toContain('idle');
  });

  it('stop() from idle does not double-notify idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Call stop from idle state
    player.stop();

    // The first stop should notify idle (transition from initial state)
    // but NOT double-notify if we call stop again while already idle
    const idleCount = states.filter((s) => s === 'idle').length;
    expect(idleCount).toBeLessThanOrEqual(1);
  });

  it('stop() after stop() does not double-notify idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // First: transition to playing then stop
    videoElement.dispatchEvent(new Event('play'));
    player.stop();
    const idleCountAfterFirstStop = states.filter((s) => s === 'idle').length;
    expect(idleCountAfterFirstStop).toBe(1);

    // Second stop() should be a no-op for state notification
    player.stop();
    const idleCountAfterSecondStop = states.filter((s) => s === 'idle').length;

    // No additional idle notifications
    expect(idleCountAfterSecondStop).toBe(idleCountAfterFirstStop);
  });

  it('stop() from buffering state notifies idle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to buffering
    videoElement.dispatchEvent(new Event('waiting'));
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
    videoElement.dispatchEvent(new Event('play'));

    player.stop();

    expect(videoElement.paused).toBe(true);
  });
});
