/**
 * L2b-1 — Autoplay rejection and canplay state bug tests.
 * RED: These tests prove the bugs exist before the fix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('VideoPlayer L2b-1: autoplay rejection and canplay state', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('play() autoplay rejection sets state to error (webOS bug)', async () => {
    const player = createVideoPlayer(videoElement);

    // Mock play() to reject (simulates autoplay being blocked)
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')),
      configurable: true,
    });

    player.play('/stream/test.mp4');

    // Wait for the promise rejection to be processed
    await new Promise((r) => setTimeout(r, 50));

    // BUG: currentState is still 'idle' instead of 'error'
    expect(player.getState()).toBe('error');
  });

  it('play() autoplay rejection notifies state change callbacks (webOS bug)', async () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Mock play() to reject
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')),
      configurable: true,
    });

    player.play('/stream/test.mp4');
    await new Promise((r) => setTimeout(r, 50));

    // notifyState('error') is called but currentState isn't set — verify state is accessible
    expect(states).toContain('error');
  });

  it('canplay event sets state to playing (webOS bug)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Simulate buffering → canplay sequence
    videoElement.dispatchEvent(new Event('waiting'));
    expect(player.getState()).toBe('buffering');

    videoElement.dispatchEvent(new Event('canplay'));

    // BUG: currentState stays 'buffering', only callbacks are notified
    expect(player.getState()).toBe('playing');
  });

  it('canplay event notifies playing state from buffering', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    videoElement.dispatchEvent(new Event('waiting'));
    videoElement.dispatchEvent(new Event('canplay'));

    expect(states).toContain('playing');
  });

  it('resume() autoplay rejection sets state to error', async () => {
    const player = createVideoPlayer(videoElement);

    // Set up initial playing state
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    // Mock play() to reject (simulates autoplay being blocked on resume)
    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')),
      configurable: true,
    });

    player.resume();
    await new Promise((r) => setTimeout(r, 50));

    // BUG: state remains 'playing' instead of transitioning to 'error'
    expect(player.getState()).toBe('error');
  });
});
