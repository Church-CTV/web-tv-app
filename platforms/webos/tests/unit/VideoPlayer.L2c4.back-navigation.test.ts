import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

/**
 * L2c-4 — Back-navigation state cleanup
 *
 * Bug: After stop() is called (e.g., during back navigation), stale buffering
 * or canplay events from the old video source can cause the state to transition
 * out of 'idle' back to 'buffering' or 'playing'. This breaks the contract
 * that stop() resets the player to a clean idle state.
 *
 * Fix: Add a `stopped` flag that's set in stop() and cleared in play().
 * Event handlers for waiting/stalled/canplay check this flag and ignore
 * events if the player is stopped.
 */
describe('VideoPlayer - L2c-4: Back-navigation state cleanup', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    document.body.appendChild(videoElement);
    player = createVideoPlayer(videoElement);
  });

  it('RED: should not transition from idle to buffering on stale waiting event after stop()', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.stop();
    expect(player.getState()).toBe('idle');

    videoElement.dispatchEvent(new Event('waiting'));
    expect(player.getState()).toBe('idle');
  });

  it('RED: should not transition from idle to playing on stale canplay event after stop()', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.stop();
    expect(player.getState()).toBe('idle');

    videoElement.dispatchEvent(new Event('canplay'));
    expect(player.getState()).toBe('idle');
  });

  it('RED: should not transition from idle to buffering on stale stalled event after stop()', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.stop();
    expect(player.getState()).toBe('idle');

    videoElement.dispatchEvent(new Event('stalled'));
    expect(player.getState()).toBe('idle');
  });

  it('GREEN: should allow normal state transitions after play() following stop()', () => {
    player.stop();
    expect(player.getState()).toBe('idle');

    player.play('test.mp4');
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');
  });

  it('GREEN: should still work normally without prior stop()', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    videoElement.dispatchEvent(new Event('waiting'));
    expect(player.getState()).toBe('buffering');

    videoElement.dispatchEvent(new Event('canplay'));
    expect(player.getState()).toBe('playing');
  });

  it('GREEN: should still allow pause() to work after stop()', () => {
    videoElement.dispatchEvent(new Event('play'));
    player.stop();
    expect(player.getState()).toBe('idle');

    player.play('test.mp4');
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.pause();
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');
  });
});
