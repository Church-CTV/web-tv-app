/**
 * VideoScreen Integration — Position Tracking to Continue Watching
 *
 * Verifies that VideoScreen saves playback position to Continue Watching store.
 * This bridges the gap between video playback and the Continue Watching feature.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen } from '../../src/ui/VideoScreen';
import { savePosition } from '@ctv/core/continue-watching/ContinueWatching';
import { createStorageAdapter } from '../../src/Adapter/Storage';

// Mock the savePosition function
vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  savePosition: vi.fn(),
  getContinueWatching: vi.fn(() => []),
  getPosition: vi.fn(() => 0),
  hasPartiallyWatched: vi.fn(() => false),
  removeFromContinueWatching: vi.fn(),
  clearContinueWatching: vi.fn(),
}));

describe('VideoScreen Integration with Continue Watching', () => {
  let container: HTMLDivElement;
  let storage: ReturnType<typeof createStorageAdapter>;
  let mockSavePosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
    storage = createStorageAdapter();
    mockSavePosition = vi.mocked(savePosition);
    mockSavePosition.mockClear();
  });

  it('saves position to Continue Watching when video ends', () => {
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      storage: storage,
    });

    // Mock player methods before dispatching events
    const videoEl = screen.querySelector('video') as HTMLVideoElement;

    // Mock getPosition to return 15 seconds
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(15);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate video ended event
    videoEl.dispatchEvent(new Event('ended'));

    // Should have called savePosition with position
    expect(mockSavePosition).toHaveBeenCalledWith(
      expect.any(Object),
      'test-video',
      expect.any(String),
      15,
      120
    );
  });

  it('saves position to Continue Watching on back navigation', () => {
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      onBack: () => {},
      storage: storage,
    });

    // Mock player methods
    const videoEl = screen.querySelector('video') as HTMLVideoElement;
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(45);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate back button click
    const backBtn = screen.querySelector('[data-action="back"]') as HTMLButtonElement;
    backBtn?.click();

    // Should have called savePosition
    expect(mockSavePosition).toHaveBeenCalled();
  });

  it('saves position on video end regardless of threshold', () => {
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      storage: storage,
    });

    // Mock player methods
    const videoEl = screen.querySelector('video') as HTMLVideoElement;
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(5);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate video ended immediately (position = 5 seconds)
    videoEl.dispatchEvent(new Event('ended'));

    // Should have saved on video end (threshold is bypassed when video ends)
    expect(mockSavePosition).toHaveBeenCalled();
    expect(mockSavePosition).toHaveBeenCalledWith(storage, 'test-video', 'Test Video', 5, 120);
  });

  it('saves position periodically while playing', async () => {
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      storage: storage,
    });

    // Mock player methods
    const videoEl = screen.querySelector('video') as HTMLVideoElement;
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(15);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate timeupdate events at different positions
    videoEl.dispatchEvent(new Event('play'));
    videoEl.dispatchEvent(new Event('timeupdate'));
    videoEl.dispatchEvent(new Event('pause'));

    // Should have saved at least once (after 10s threshold)
    expect(mockSavePosition).toHaveBeenCalled();
  });
});
