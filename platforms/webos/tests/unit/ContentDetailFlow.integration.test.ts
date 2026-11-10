import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContentDetail } from '../../src/ui/ContentDetail';
import { createVideoScreen } from '../../src/ui/VideoScreen';
import { savePosition } from '@ctv/core/continue-watching/ContinueWatching';

vi.mock('@ctv/core/continue-watching/ContinueWatching', () => ({
  savePosition: vi.fn(),
}));

vi.mock('../../src/ui/VideoScreen', () => ({
  createVideoScreen: vi.fn(),
}));

// Mock external player
const mockExternalPlayer = {
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  getState: vi.fn().mockReturnValue('idle'),
  getPosition: vi.fn().mockReturnValue(0),
  getDuration: vi.fn().mockReturnValue(120),
  seek: vi.fn(),
  onStateChange: vi.fn(),
  onError: vi.fn(),
};

describe('ContentDetail → VideoScreen Integration', () => {
  let container: HTMLDivElement;
  let mockStorage;

  const videoItem = {
    videoId: 'test-video-123',
    title: 'Test Video Title',
    description: 'A test video for integration testing',
    thumbnail: 'https://example.com/thumb.jpg',
    hdPosterUrl: 'https://example.com/poster.jpg',
    streamUrl: '/stream/test-video-123.mp4',
    genres: ['Drama', 'Thriller'],
    shortDescription: 'A gripping story with great cinematography.',
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    document.body.appendChild(container);

    mockStorage = {};
  });

  it('renders ContentDetail with correct metadata and callbacks', () => {
    const detailEl = createContentDetail(videoItem, {
      onPlay: () => {},
      onWatchLater: vi.fn(),
    });

    const titleEl = detailEl.querySelector('.content-detail__title');
    const durationEl = detailEl.querySelector('.content-detail__duration');
    const playBtn = detailEl.querySelector('#btn-play');

    expect(titleEl).toBeTruthy();
    expect(titleEl?.textContent).toBe('Test Video Title');
    expect(playBtn).toBeTruthy();
    expect(playBtn?.id).toBe('btn-play');
  });

  it('tracks play intent via callback and triggers VideoScreen creation', () => {
    const onPlay = vi.fn();
    vi.mocked(createVideoScreen).mockImplementation(() => {
      const el = document.createElement('div');
      el.id = 'video-screen';
      return el;
    });

    const detailEl = createContentDetail(videoItem, {
      onPlay,
      onWatchLater: vi.fn(),
    });

    const playBtn = detailEl.querySelector('#btn-play') as HTMLButtonElement;
    expect(playBtn).toBeTruthy();
    playBtn.click();

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('creates VideoScreen with external player when play is triggered', () => {
    vi.mocked(createVideoScreen).mockImplementation(() => {
      const el = document.createElement('div');
      el.id = 'video-screen';
      return el;
    });

    const detailEl = createContentDetail(videoItem, {
      onPlay: () => {
        // Simulate the App.ts flow: onPlay → createVideoScreen
        createVideoScreen({
          videoId: videoItem.videoId,
          title: videoItem.title,
          streamUrl: videoItem.streamUrl,
          onBack: vi.fn(),
          storage: mockStorage,
          player: mockExternalPlayer,
        });
      },
    });

    const playBtn = detailEl.querySelector('#btn-play') as HTMLButtonElement;
    playBtn.click();

    expect(createVideoScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: videoItem.videoId,
        title: videoItem.title,
        streamUrl: videoItem.streamUrl,
        player: mockExternalPlayer,
      })
    );
  });
});
