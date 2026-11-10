/**
 * L2c-3 — Notification dedup guards (Tizen)
 *
 * Bugs (RED tests):
 * onWaiting, onStalled, onEnded, onError have no dedup guards —
 * repeated events fire duplicate notifications to consumers.
 * (Tizen uses 'playing' event instead of 'canplay'; onPlaying already has a guard.)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('L2c-3: notification dedup guards (Tizen)', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    player = createVideoPlayer(videoElement);
  });

  afterEach(() => {
    player.stop();
  });

  describe('notification dedup guards', () => {
    it('repeated ended events fire only one ended notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('ended'));
      videoElement.dispatchEvent(new Event('ended'));

      const endedCount = states.filter((s) => s === 'ended').length;
      expect(endedCount).toBe(1);
    });

    it('repeated waiting events fire only one buffering notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('waiting'));
      videoElement.dispatchEvent(new Event('waiting'));

      const bufferingCount = states.filter((s) => s === 'buffering').length;
      expect(bufferingCount).toBe(1);
    });

    it('repeated stalled events fire only one buffering notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('stalled'));
      videoElement.dispatchEvent(new Event('stalled'));

      const bufferingCount = states.filter((s) => s === 'buffering').length;
      expect(bufferingCount).toBe(1);
    });

    it('repeated error events fire only one error notification', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('error'));
      videoElement.dispatchEvent(new Event('error'));

      const errorCount = states.filter((s) => s === 'error').length;
      expect(errorCount).toBe(1);
    });

    it('ended notification is not suppressed when transitioning from playing', () => {
      const states: string[] = [];
      player.onStateChange((s) => states.push(s));

      videoElement.dispatchEvent(new Event('playing'));
      expect(player.getState()).toBe('playing');

      videoElement.dispatchEvent(new Event('ended'));
      expect(player.getState()).toBe('ended');

      const endedCount = states.filter((s) => s === 'ended').length;
      expect(endedCount).toBe(1);
    });
  });
});
