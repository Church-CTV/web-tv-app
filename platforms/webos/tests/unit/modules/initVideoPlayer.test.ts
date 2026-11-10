/**
 * initVideoPlayer — unit tests.
 * Tests createVideoPlayer factory from webOS platform.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createVideoPlayer } from '../../../src/modules/initVideoPlayer';
import * as VideoPlayerAdapter from '../../../src/Adapter/VideoPlayer';

describe('initVideoPlayer', () => {
  let mockElement: HTMLVideoElement;
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockElement = document.createElement('video');
    mockElement.id = 'video-player';
    document.body.appendChild(mockElement);

    createSpy = vi.spyOn(VideoPlayerAdapter, 'createVideoPlayer');
    createSpy.mockReturnValue({
      play: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      getPosition: () => 0,
      getDuration: () => 100,
      isPlaying: () => false,
      getState: () => 'idle',
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('queries DOM for video element', () => {
    createVideoPlayer('video-player');
    expect(createSpy).toHaveBeenCalledWith(mockElement);
  });

  it('uses default #video-player element when no id provided', () => {
    createVideoPlayer();
    expect(createSpy).toHaveBeenCalledWith(mockElement);
  });

  it('returns null when element not found', () => {
    createSpy.mockReset();
    document.body.innerHTML = '';

    const player = createVideoPlayer('nonexistent');
    expect(player).toBeNull();
  });

  it('delegates to createVideoPlayer adapter', () => {
    const result = createVideoPlayer('video-player');
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(createSpy).toHaveBeenCalledOnce();
  });

  it('play delegates to adapter', () => {
    const result = createVideoPlayer('video-player');
    const mockPlay = vi.fn();
    (result as any).play = mockPlay;
    (result as any).play('/stream/test.mp4');
  });

  it('pause delegates to adapter', () => {
    const result = createVideoPlayer('video-player');
    const mockPause = vi.fn();
    (result as any).pause = mockPause;
    (result as any).pause();
  });

  it('returns VideoPlayer type when element exists', () => {
    const result = createVideoPlayer('video-player');
    expect(typeof result?.getState).toBe('function');
    expect(typeof result?.getPosition).toBe('function');
    expect(typeof result?.getDuration).toBe('function');
  });
});
