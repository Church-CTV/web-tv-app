import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen } from '../../src/ui/VideoScreen';
import { savePosition } from '@ctv/core/continue-watching/ContinueWatching';

vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  savePosition: vi.fn(),
}));

describe('VideoScreen Continue Watching Integration', () => {
  let container: HTMLDivElement;

  const mockStorage = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    document.body.appendChild(container);
  });

  it('saves position periodically when external player playback starts', () => {
    vi.useFakeTimers();
    try {
      const externalPlayer = {
        play: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        getState: vi.fn().mockReturnValue('idle'),
        getPosition: vi.fn().mockReturnValue(15),
        getDuration: vi.fn().mockReturnValue(120),
        seek: vi.fn(),
        onStateChange: vi.fn(),
        onError: vi.fn(),
        isPlaying: vi.fn().mockReturnValue(false),
      };

      const videoScreen = createVideoScreen({
        videoId: 'test-video',
        title: 'Test Video',
        streamUrl: '/stream/test.mp4',
        onBack: vi.fn(),
        storage: mockStorage as any,
        player: externalPlayer,
      });

      // Get the video element that VideoScreen created
      const videoEl = videoScreen.querySelector('video') as HTMLVideoElement;
      expect(videoEl).toBeTruthy();

      // Dispatch a 'play' event on the video element to simulate playback starting.
      // This is what VideoScreen actually listens to (not externalPlayer.play()).
      videoEl.dispatchEvent(new Event('play'));

      // Allow timers to fire
      vi.advanceTimersByTime(30000);

      expect(savePosition).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
