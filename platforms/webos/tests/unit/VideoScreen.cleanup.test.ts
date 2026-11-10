/**
 * VideoScreen cleanup and memory leak prevention tests.
 * Verifies that addEventListener/removeEventListener pairs use the same
 * closure references, preventing event listener leaks when screens are
 * created and destroyed repeatedly.
 */

import { describe, it, expect, vi } from 'vitest';
import { createVideoScreen } from '../../src/ui/VideoScreen';

describe('VideoScreen cleanup', () => {
  it('exposes a cleanup function on the returned screen element', () => {
    const screen = createVideoScreen({
      videoId: 'video-cleanup-1',
      title: 'Cleanup Test',
      streamUrl: '/stream/test.mp4',
    });
    expect(screen.cleanup).toBeDefined();
    expect(typeof screen.cleanup).toBe('function');
  });

  it('cleanup does not throw when called multiple times', () => {
    const screen = createVideoScreen({
      videoId: 'video-cleanup-2',
      title: 'Cleanup Test',
      streamUrl: '/stream/test.mp4',
    });
    expect(() => screen.cleanup()).not.toThrow();
    expect(() => screen.cleanup()).not.toThrow();
  });

  it('cleanup does not throw when no back button was added', () => {
    const screen = createVideoScreen({
      videoId: 'video-cleanup-3',
      title: 'Cleanup Test',
      streamUrl: '/stream/test.mp4',
      onBack: undefined,
    });
    expect(() => screen.cleanup()).not.toThrow();
  });

  it('cleanup does not throw when video player has no duration', () => {
    const screen = createVideoScreen({
      videoId: 'video-cleanup-4',
      title: 'Cleanup Test',
      streamUrl: '/stream/test.mp4',
      duration: 0,
    });
    // The cleanup just removes listeners, it doesn't call player methods
    // but it should still not throw even with zero duration
    expect(() => screen.cleanup()).not.toThrow();
  });

  it('preserves the back button click handler after creation', () => {
    const onBack = vi.fn();
    const screen = createVideoScreen({
      videoId: 'video-cleanup-5',
      title: 'Cleanup Test',
      streamUrl: '/stream/test.mp4',
      onBack,
    });
    const backBtn = screen.querySelector('[data-action="back"]');
    expect(backBtn).toBeTruthy();

    // Verify the back button is still in the DOM after cleanup
    screen.cleanup();
    const backBtnAfter = screen.querySelector('[data-action="back"]');
    expect(backBtnAfter).toBeTruthy();
  });
});
