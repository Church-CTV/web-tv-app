/**
 * L2b-5 — Tizen getPosition() parity with webOS.
 *
 * Parity gap: webOS VideoPlayer exposes getPosition() but Tizen only exposes
 * getCurrentTime(). Cross-platform consumers relying on getPosition() cannot
 * run on Tizen. Both methods must exist on all platforms returning the same value.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Tizen VideoPlayer L2b-5: getPosition() parity', () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
  });

  it('exposes getPosition as a function', () => {
    const player = createVideoPlayer(videoElement);
    expect(typeof (player as any).getPosition).toBe('function');
  });

  it('getPosition returns the video element currentTime', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.currentTime = 45;
    expect((player as any).getPosition()).toBe(45);
  });

  it('getPosition returns 0 for fresh element', () => {
    const player = createVideoPlayer(videoElement);
    expect((player as any).getPosition()).toBe(0);
  });

  it('getPosition matches getCurrentTime', () => {
    const player = createVideoPlayer(videoElement);
    videoElement.currentTime = 120;
    expect((player as any).getPosition()).toBe(player.getCurrentTime());
  });

  it('getPosition returns 0 after seek to 0', () => {
    const player = createVideoPlayer(videoElement);
    player.seek(99);
    videoElement.currentTime = 99;
    expect((player as any).getPosition()).toBe(99);
    videoElement.currentTime = 0;
    expect((player as any).getPosition()).toBe(0);
  });
});
