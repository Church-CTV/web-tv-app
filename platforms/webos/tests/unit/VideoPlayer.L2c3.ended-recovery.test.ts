/**
 * L2c-3 — Ended-state recovery and notification dedup guards (webOS)
 *
 * Bugs (RED tests):
 * 1. onCanplay doesn't allow transition from 'ended' to 'playing' —
 *    seeking after a video ends leaves state stuck in 'ended'.
 * 2. onEnded, onWaiting, onStalled, onError have no dedup guards —
 *    repeated events fire duplicate notifications to consumers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('L2c-3: ended-state recovery and dedup guards (webOS)', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    player = createVideoPlayer(videoElement);
  });

  afterEach(() => {
    player.stop();
  });

  // ---- ended→playing recovery (webOS-specific bug) ----

  describe('ended-state recovery', () => {
    it('seek after ended + canplay should transition to playing', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      // Video ends
      videoElement.dispatchEvent(new Event('ended'));
      expect(player.getState()).toBe('ended');

      // User seeks to replay
      player.seek(10);

      // Browser fires canplay (ready to play from new position)
      videoElement.dispatchEvent(new Event('canplay'));

      // BUG: state stays 'ended' because onCanplay only allows from buffering/error
      // EXPECTED: state should be 'playing'
      expect(player.getState()).toBe('playing');
    });

    it('onCanplay from ended state notifies playing exactly once', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('ended'));
      videoElement.dispatchEvent(new Event('canplay'));

      const playingCount = states.filter((s) => s === 'playing').length;
      expect(playingCount).toBe(1);
    });
  });

  // ---- notification dedup guards ----

  describe('notification dedup guards', () => {
    it('repeated ended events fire only one ended notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      // Simulate ended event firing twice (can happen in some browsers)
      videoElement.dispatchEvent(new Event('ended'));
      videoElement.dispatchEvent(new Event('ended'));

      const endedCount = states.filter((s) => s === 'ended').length;
      // BUG: currently 2, should be 1
      expect(endedCount).toBe(1);
    });

    it('repeated waiting events fire only one buffering notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      // Simulate waiting event firing twice (common during network fluctuations)
      videoElement.dispatchEvent(new Event('waiting'));
      videoElement.dispatchEvent(new Event('waiting'));

      const bufferingCount = states.filter((s) => s === 'buffering').length;
      // BUG: currently 2, should be 1
      expect(bufferingCount).toBe(1);
    });

    it('repeated stalled events fire only one buffering notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('stalled'));
      videoElement.dispatchEvent(new Event('stalled'));

      const bufferingCount = states.filter((s) => s === 'buffering').length;
      // BUG: currently 2, should be 1
      expect(bufferingCount).toBe(1);
    });

    it('repeated error events fire only one error notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('error'));
      videoElement.dispatchEvent(new Event('error'));

      const errorCount = states.filter((s) => s === 'error').length;
      // BUG: currently 2, should be 1
      expect(errorCount).toBe(1);
    });

    it('ended notification is not suppressed when transitioning from playing', () => {
      // Ensure the dedup guard doesn't block legitimate transitions
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      // Playing → ended (legitimate transition)
      videoElement.dispatchEvent(new Event('play'));
      expect(player.getState()).toBe('playing');

      videoElement.dispatchEvent(new Event('ended'));
      expect(player.getState()).toBe('ended');

      const endedCount = states.filter((s) => s === 'ended').length;
      expect(endedCount).toBe(1);
    });
  });
});
