/**
 * L2b-2 — Stall recovery tests (TDD RED).
 *
 * Gap: no platform listens for the HTML5 <video> `stalled` event (MEDIA_ERR
 * transient network stall). When a stall occurs the browser pauses playback,
 * but the player state stays 'playing' and state-change consumers (UI,
 * analytics) never hear about the outage. Recovery (stalled -> resumed) is
 * likewise silent: state never transitions back to 'playing'.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('webOS VideoPlayer L2b-2: stall recovery', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('stalled event during playback transitions state to buffering', () => {
    const player = createVideoPlayer(videoElement);

    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    // Network stall: browser pauses playback, media stalls.
    videoElement.dispatchEvent(new Event('stalled'));

    expect(player.getState()).toBe('buffering');
  });

  it('stalled event notifies state-change subscribers (buffering)', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('stalled'));

    expect(states).toContain('buffering');
  });

  it('resume after stalled transitions state back to playing', () => {
    const player = createVideoPlayer(videoElement);

    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('stalled'));
    expect(player.getState()).toBe('buffering');

    // Stream recovers: playback resumes. webOS uses `canplay` as
    // its recovery signal (platform difference from Tizen/Vizio).
    videoElement.dispatchEvent(new Event('canplay'));

    expect(player.getState()).toBe('playing');
    expect(player.isPlaying()).toBe(true);
  });

  it('full stall cycle emits the complete state sequence', () => {
    const player = createVideoPlayer(videoElement);
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('stalled'));
    videoElement.dispatchEvent(new Event('canplay'));

    expect(states).toEqual(['playing', 'buffering', 'playing']);
  });
});
