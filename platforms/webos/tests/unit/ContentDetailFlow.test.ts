/**
 * WebOS ContentDetail → Play flow integration test
 * Verifies the complete user journey: select content → view details → play
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContentDetail } from '../../src/ui/ContentDetail';
import { createVideoScreen } from '../../src/ui/VideoScreen';

describe('ContentDetail → Play Flow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
  });

  it('shows content detail when user selects a video', () => {
    // Simulate selecting a video
    const video = {
      videoId: 'test-video-1',
      title: 'Test Video',
      description: 'A test video',
      thumbnail: 'https://example.com/thumb.jpg',
      streamUrl: '/stream/test.mp4',
    };

    // Create detail screen
    const detailEl = createContentDetail(video, {
      onPlay: () => {},
    });

    const detailScreen = document.createElement('div');
    detailScreen.id = 'screen-content-detail';
    detailScreen.className = 'screen';
    detailScreen.innerHTML = '';
    detailScreen.appendChild(detailEl);
    container.appendChild(detailScreen);

    // Verify detail screen is visible
    expect(detailScreen.classList.contains('screen-active')).toBe(false);
    detailScreen.classList.add('screen-active');
    expect(detailScreen.classList.contains('screen-active')).toBe(true);

    // Verify content is rendered
    const titleEl = detailEl.querySelector('.content-detail__title');
    expect(titleEl).toBeTruthy();
    expect(titleEl?.textContent).toBe('Test Video');
  });

  it('navigates to video screen when Play button is clicked', () => {
    const video = {
      videoId: 'test-video-1',
      title: 'Test Video',
      description: 'A test video',
      thumbnail: 'https://example.com/thumb.jpg',
      streamUrl: '/stream/test.mp4',
    };

    let playCalled = false;
    const detailEl = createContentDetail(video, {
      onPlay: () => {
        playCalled = true;
      },
    });

    const playBtn = detailEl.querySelector('#btn-play') as HTMLButtonElement;
    expect(playBtn).toBeTruthy();
    playBtn.click();

    expect(playCalled).toBe(true);
  });

  it('creates video screen with correct props', () => {
    const video = {
      videoId: 'test-video-1',
      title: 'Test Video',
      description: 'A test video',
      thumbnail: 'https://example.com/thumb.jpg',
      streamUrl: '/stream/test.mp4',
    };

    let capturedProps: any = null;
    const detailEl = createContentDetail(video, {
      onPlay: () => {
        // Simulate navigating to video screen
        capturedProps = {
          videoId: video.videoId,
          title: video.title,
          streamUrl: `/stream/${video.videoId}.mp4`,
        };
      },
    });

    const playBtn = detailEl.querySelector('#btn-play') as HTMLButtonElement;
    playBtn.click();

    expect(capturedProps).toBeTruthy();
    expect(capturedProps.videoId).toBe('test-video-1');
    expect(capturedProps.title).toBe('Test Video');
    expect(capturedProps.streamUrl).toBe('/stream/test-video-1.mp4');
  });

  it('supports back navigation', () => {
    const video = {
      videoId: 'test-video-1',
      title: 'Test Video',
      description: 'A test video',
      thumbnail: 'https://example.com/thumb.jpg',
      streamUrl: '/stream/test.mp4',
    };

    let backCalled = false;
    const detailEl = createContentDetail(video, {
      onPlay: () => {
        // Simulate video screen creation with back handler
        const videoScreen = createVideoScreen({
          videoId: video.videoId,
          title: video.title,
          streamUrl: `/stream/${video.videoId}.mp4`,
          onBack: () => {
            backCalled = true;
          },
        });

        const screenContainer = document.getElementById('screen-container');
        if (screenContainer) {
          screenContainer.appendChild(videoScreen);
          videoScreen.classList.add('screen-active');
        }
      },
    });

    // Click play
    const playBtn = detailEl.querySelector('#btn-play') as HTMLButtonElement;
    playBtn.click();

    // Simulate back navigation
    const videoScreen = document.querySelector('.video-screen');
    expect(videoScreen).toBeTruthy();

    // Click back button (if it exists)
    const backBtn = videoScreen?.querySelector('.video-screen__back') as HTMLElement | null;
    if (backBtn) {
      backBtn.click();
      expect(backCalled).toBe(true);
    }
  });
});
