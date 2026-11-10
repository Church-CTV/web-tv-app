/**
 * Vizio initVideoPlayer — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVideoPlayer } from '../../src/modules/initVideoPlayer';

describe('Vizio initVideoPlayer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<video id="video-player"></video>';
    const video = document.getElementById('video-player') as HTMLVideoElement;
    Object.defineProperty(video, 'play', { value: () => Promise.resolve() });
    Object.defineProperty(video, 'pause', { value: () => {} });
  });

  it('creates a video player when container exists', () => {
    const player = createVideoPlayer('video-player');
    expect(player).not.toBeNull();
    expect(typeof player!.play).toBe('function');
    expect(typeof player!.pause).toBe('function');
    expect(typeof player!.seek).toBe('function');
    expect(typeof player!.getState).toBe('function');
    expect(typeof player!.getDuration).toBe('function');
    expect(typeof player!.getCurrentTime).toBe('function');
  });

  it('returns null when container does not exist', () => {
    const player = createVideoPlayer('nonexistent');
    expect(player).toBeNull();
  });

  it('defaults to video-player id when no containerId given', () => {
    const player = createVideoPlayer();
    expect(player).not.toBeNull();
  });

  it('sets video src on play', () => {
    const player = createVideoPlayer('video-player');
    player!.play('/stream/test.mp4');
    const video = document.getElementById('video-player') as HTMLVideoElement;
    expect(video.src).toContain('/stream/test.mp4');
  });

  it('reports correct initial state', () => {
    const player = createVideoPlayer('video-player');
    expect(player!.getState()).toBe('idle');
  });

  it('seeks to a specific position', () => {
    const player = createVideoPlayer('video-player');
    player!.seek(30);
    expect(player!.getCurrentTime()).toBe(30);
  });

  it('reports zero duration for unconfigured video', () => {
    const player = createVideoPlayer('video-player');
    expect(player!.getDuration()).toBe(0);
  });

  it('stops the video', () => {
    const player = createVideoPlayer('video-player');
    player!.stop();
    expect(player!.getState()).toBe('idle');
  });

  it('resumes video', () => {
    const player = createVideoPlayer('video-player');
    player!.play('/stream/test.mp4');
    player!.resume();
    const video = document.getElementById('video-player') as HTMLVideoElement;
    expect(video.src).toContain('/stream/test.mp4');
  });
});
