/**
 * Continue Watching Integration — RED Test
 *
 * Verifies that VideoScreen does NOT save position when storage is not provided.
 * This test documents the gap: VideoScreen component supports storage, but App.ts
 * never passes it, so position tracking is dead code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen } from '../../src/ui/VideoScreen';
import { savePosition } from '@ctv/core/continue-watching/ContinueWatching';

// Mock savePosition to verify it's NOT called
vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  savePosition: vi.fn(),
  getContinueWatching: vi.fn(() => []),
  getPosition: vi.fn(() => 0),
  hasPartiallyWatched: vi.fn(() => false),
  removeFromContinueWatching: vi.fn(),
  clearContinueWatching: vi.fn(),
}));

describe('Continue Watching Integration — RED (before fix)', () => {
  let container: HTMLDivElement;
  let mockSavePosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
    mockSavePosition = vi.mocked(savePosition);
    mockSavePosition.mockClear();
  });

  it('does NOT save position when storage is not provided (gap exists)', () => {
    // Simulate App.ts behavior: createVideoScreen WITHOUT storage
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      // NOTE: storage is NOT provided — this is the gap
    });

    const videoEl = screen.querySelector('video') as HTMLVideoElement;
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(45);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate video ended event
    videoEl.dispatchEvent(new Event('ended'));

    // RED: savePosition should NOT have been called
    expect(mockSavePosition).not.toHaveBeenCalled();
  });

  it('does NOT save position on pause when storage is not provided', () => {
    const screen = createVideoScreen({
      videoId: 'test-video',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 120,
      // NOTE: storage is NOT provided
    });

    const videoEl = screen.querySelector('video') as HTMLVideoElement;
    vi.spyOn(videoEl, 'currentTime', 'get').mockReturnValue(30);
    vi.spyOn(videoEl, 'duration', 'get').mockReturnValue(120);

    // Simulate pause
    videoEl.dispatchEvent(new Event('pause'));

    // RED: savePosition should NOT have been called
    expect(mockSavePosition).not.toHaveBeenCalled();
  });
});
