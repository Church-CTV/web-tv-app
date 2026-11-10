/**
 * L2b-1 — Autoplay rejection bug tests (Tizen).
 * RED: resume() autoplay rejection silently swallowed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Tizen VideoPlayer L2b-1: autoplay rejection recovery', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('resume() autoplay rejection sets state to error', async () => {
    const player = createVideoPlayer(videoElement);

    // Set up initial playing state
    videoElement.dispatchEvent(new Event('playing'));
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

  it('resume() autoplay rejection notifies state change callbacks', async () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    videoElement.dispatchEvent(new Event('playing'));

    Object.defineProperty(videoElement, 'play', {
      value: () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')),
      configurable: true,
    });

    player.resume();
    await new Promise((r) => setTimeout(r, 50));

    expect(states).toContain('error');
  });
});
