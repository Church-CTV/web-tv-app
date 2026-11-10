/**
 * L2c-1 — Seek recovery from error state (TDD RED).
 *
 * Gap: When seeking from 'error' state, no platform transitions to 'buffering'.
 * The user action (seeking) indicates an intent to recover, but the state machine
 * doesn't reflect it. State stays 'error' until 'play' event fires asynchronously.
 *
 * This creates a UX gap: UI consumers checking state immediately after seek()
 * see 'error' instead of the expected 'buffering' state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('webOS VideoPlayer L2c-1: seek recovery from error', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    player = createVideoPlayer(videoElement);
  });

  it('seeking from error state transitions to buffering', () => {
    // Enter error state
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    // Seek to recover
    player.seek(30);

    // State should reflect recovery attempt (buffering)
    expect(player.getState()).toBe('buffering');
  });

  it('seeking from error notifies state subscribers', () => {
    const states: string[] = [];
    player.onStateChange((state) => states.push(state));

    // Enter error state
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    // Seek to recover
    player.seek(30);

    // Should notify of buffering state
    expect(states).toContain('buffering');
  });

  it('seeking from error can recover to playing on canplay event', () => {
    // Enter error state
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    // Seek to recover
    player.seek(30);
    expect(player.getState()).toBe('buffering');

    // Media buffer ready, playback resumes
    videoElement.dispatchEvent(new Event('canplay'));
    expect(player.getState()).toBe('playing');
    expect(player.isPlaying()).toBe(true);
  });

  it('seeking during error does not prevent normal playback', () => {
    // Enter error state
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    // Seek to recover
    player.seek(45);

    // Video plays normally
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');
  });

  it('isPlaying returns false while seeking from error', () => {
    // Enter error state
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('error'));

    // Seek to recover
    player.seek(15);

    // Still not playing (buffering, not playing)
    expect(player.isPlaying()).toBe(false);
  });
});
