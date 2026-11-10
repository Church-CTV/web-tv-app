/**
 * Vizio VideoPlayer — unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

describe('Vizio VideoPlayer', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    Object.defineProperty(videoElement, 'play', { value: () => Promise.resolve() });
    player = createVideoPlayer(videoElement);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts in idle state', () => {
    expect(player.getState()).toBe('idle');
  });

  it('plays a URL', () => {
    player.play('/stream/test.mp4');
    expect(videoElement.src).toContain('/stream/test.mp4');
  });

  it('pauses playback', () => {
    player.play('/stream/test.mp4');
    player.pause();
    expect(videoElement.paused).toBe(true);
  });

  it('resumes playback', () => {
    player.play('/stream/test.mp4');
    player.pause();
    expect(() => player.resume()).not.toThrow();
  });

  it('stops playback and resets to idle', () => {
    player.play('/stream/test.mp4');
    player.stop();
    expect(player.getState()).toBe('idle');
  });

  it('seeks to a position', () => {
    player.seek(30);
    expect(videoElement.currentTime).toBe(30);
  });

  it('reports current time', () => {
    videoElement.currentTime = 45;
    expect(player.getCurrentTime()).toBe(45);
  });

  it('reports duration', () => {
    Object.defineProperty(videoElement, 'duration', { value: 120 });
    expect(player.getDuration()).toBe(120);
  });

  it('reports duration as 0 when undefined', () => {
    Object.defineProperty(videoElement, 'duration', { value: 0 });
    expect(player.getDuration()).toBe(0);
  });

  it('notifies on play event', () => {
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.getState()).toBe('playing');
  });

  it('notifies on pause event', () => {
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');
  });

  it('notifies on error event', () => {
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');
  });

  it('notifies on error event', () => {
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');
  });

  it('onStateChange fires callback on playing state', () => {
    const cb = vi.fn();
    player.onStateChange(cb);
    videoElement.dispatchEvent(new Event('playing'));
    expect(cb).toHaveBeenCalledWith('playing');
  });

  it('onStateChange fires callback on pause state', () => {
    const cb = vi.fn();
    player.onStateChange(cb);
    videoElement.dispatchEvent(new Event('pause'));
    expect(cb).toHaveBeenCalledWith('paused');
  });

  it('onStateChange fires callback on buffering state', () => {
    const cb = vi.fn();
    player.onStateChange(cb);
    videoElement.dispatchEvent(new Event('waiting'));
    expect(cb).toHaveBeenCalledWith('buffering');
  });

  it('onStateChange fires callback on ended state', () => {
    const cb = vi.fn();
    player.onStateChange(cb);
    videoElement.dispatchEvent(new Event('ended'));
    expect(cb).toHaveBeenCalledWith('ended');
  });

  it('onError fires callback on error event', () => {
    const cb = vi.fn();
    player.onError(cb);
    videoElement.dispatchEvent(new Event('error'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('isPlaying returns true when playing', () => {
    videoElement.dispatchEvent(new Event('playing'));
    expect(player.isPlaying()).toBe(true);
  });

  it('isPlaying returns false when not playing', () => {
    expect(player.isPlaying()).toBe(false);
  });

  it('destroy removes event listeners', () => {
    const states: string[] = [];
    player.onStateChange((s) => states.push(s));
    player.play('/stream/test.mp4');
    videoElement.dispatchEvent(new Event('playing'));
    expect(states).toContain('playing');

    player.destroy();
    states.length = 0;
    videoElement.dispatchEvent(new Event('playing'));
    videoElement.dispatchEvent(new Event('pause'));
    videoElement.dispatchEvent(new Event('waiting'));
    videoElement.dispatchEvent(new Event('ended'));
    expect(states).toEqual([]);
  });
});
