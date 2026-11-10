/**
 * L2b-3 — canplay recovery after error tests.
 * RED: Tests that prove the canplay recovery bug before the fix.
 *
 * Bug: webOS's onCanplay handler only transitions from 'buffering' to 'playing'.
 * If the stream recovers from an error (fast media, cached content), canplay
 * may fire directly without a preceding waiting/buffering event, leaving the
 * player stuck in 'error' state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('webOS VideoPlayer L2b-3: canplay recovery after error', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('canplay after error transitions state to playing (fast recovery)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to error
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    // User retries: stream is fast/cached, canplay fires without waiting
    videoElement.dispatchEvent(new Event('canplay'));

    // BUG: canplay guard only allows transition from 'buffering', not from 'error'
    // State stays 'error' even though the stream is ready to play
    expect(player.getState()).toBe('playing');
    expect(states).toContain('playing');
  });

  it('canplay after error notifies state change subscribers with playing', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to error
    videoElement.dispatchEvent(new Event('error'));

    // User retries: stream recovers
    videoElement.dispatchEvent(new Event('canplay'));

    expect(states).toContain('playing');
  });

  it('error -> waiting -> canplay cycle recovers to playing (slow recovery)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Transition to error
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    // User retries: stream is slow, waiting fires first
    videoElement.dispatchEvent(new Event('waiting'));
    expect(player.getState()).toBe('buffering');

    // Stream is ready
    videoElement.dispatchEvent(new Event('canplay'));

    expect(player.getState()).toBe('playing');
  });

  it('error -> canplay -> playing -> ended full lifecycle', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Error occurs
    videoElement.dispatchEvent(new Event('error'));

    // User retries: fast recovery
    videoElement.dispatchEvent(new Event('canplay'));

    // Playback completes
    videoElement.dispatchEvent(new Event('ended'));

    // Expected sequence includes recovery to playing
    expect(states).toContain('error');
    expect(states).toContain('playing');
    expect(states).toContain('ended');
  });
});
