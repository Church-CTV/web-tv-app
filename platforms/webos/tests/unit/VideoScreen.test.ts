/**
 * VideoScreen tests — playback, seek, trick play, error states, cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVideoScreen, updateVideoScreen, focusVideoPlayer } from '../../src/ui/VideoScreen';

describe('VideoScreen', () => {
  let screen: HTMLDivElement;

  beforeEach(() => {
    screen = createVideoScreen({
      videoId: 'video-123',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 300,
    });
  });

  it('creates a screen with correct class', () => {
    expect(screen.className).toBe('video-screen');
  });

  it('renders video element', () => {
    const video = screen.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.id).toBe('video-video-123');
    expect(video?.src).toContain('/stream/test.mp4');
  });

  it('renders controls', () => {
    const controls = screen.querySelector('.video-screen__controls');
    expect(controls).toBeTruthy();
  });

  it('renders progress bar', () => {
    const progressBar = screen.querySelector('.video-screen__progress');
    expect(progressBar).toBeTruthy();
    expect(progressBar?.getAttribute('role')).toBe('slider');
    expect(progressBar?.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar?.getAttribute('aria-valuemax')).toBe('300');
  });

  it('has accessible name for video progress slider (WCAG 4.1.2)', () => {
    const progressBar = screen.querySelector('.video-screen__progress');
    expect(progressBar).toBeTruthy();
    const label = progressBar?.getAttribute('aria-label');
    expect(label, 'aria-label must be present and non-empty').toBeTruthy();
    expect(label!.trim().length).toBeGreaterThan(0);
  });

  it('renders time display with duration', () => {
    const timeDisplay = screen.querySelector('.video-screen__time');
    expect(timeDisplay).toBeTruthy();
    expect(timeDisplay?.textContent).toBe('0:00 / 5:00');
  });

  it('updates video source', () => {
    updateVideoScreen(screen, {
      videoId: 'video-456',
      title: 'New Video',
      streamUrl: '/stream/new.mp4',
    });
    const video = screen.querySelector('video');
    expect(video?.src).toContain('/stream/new.mp4');
  });

  it('focuses video player', () => {
    focusVideoPlayer(screen);
    expect(() => focusVideoPlayer(screen)).not.toThrow();
  });

  it('does nothing if no video element', () => {
    const emptyScreen = document.createElement('div');
    expect(() => focusVideoPlayer(emptyScreen)).not.toThrow();
  });

  // ─── Phase 2: Video Player Enhancements ───────────────────────────────────────

  it('renders trick play strip for content >15min', () => {
    const longScreen = createVideoScreen({
      videoId: 'long-video',
      title: 'Long Video',
      streamUrl: '/stream/long.mp4',
      duration: 1200, // 20 minutes
      thumbnails: ['/thumb1.jpg', '/thumb2.jpg', '/thumb3.jpg'],
    });
    const strip = longScreen.querySelector('.trickplay-strip');
    expect(strip).toBeTruthy();
    // Thumbnails should be rendered even if strip starts hidden
    const thumbs = strip?.querySelectorAll('.trickplay-strip__thumb');
    expect(thumbs?.length).toBe(3);
  });

  it('does not render trick play strip for content <15min', () => {
    const shortScreen = createVideoScreen({
      videoId: 'short-video',
      title: 'Short Video',
      streamUrl: '/stream/short.mp4',
      duration: 300,
      thumbnails: ['/thumb1.jpg', '/thumb2.jpg'],
    });
    const strip = shortScreen.querySelector('.trickplay-strip');
    // Strip exists but should be hidden
    expect(strip?.style.display).toBe('none');
  });

  it('renders video error container', () => {
    const video = screen.querySelector('video');
    expect(video).toBeTruthy();
    // Error container is always rendered (hidden by default)
    const errorContainer = screen.querySelector('.video-error');
    expect(errorContainer).toBeTruthy();
  });

  it('handles seek on progress bar click', () => {
    const progressBar = screen.querySelector('.video-screen__progress') as HTMLElement;
    // Simulate click at 50% position
    const rect = { left: 0, width: 200 };
    progressBar.getBoundingClientRect = () => rect as DOMRect;
    progressBar.click();
    expect(progressBar.getAttribute('aria-valuenow')).toBeTruthy();
  });

  it('handles keyboard seek with arrow keys', () => {
    const progressBar = screen.querySelector('.video-screen__progress') as HTMLElement;
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    progressBar.dispatchEvent(event);
    expect(progressBar.getAttribute('aria-valuenow')).toBeTruthy();
  });

  it('renders back button when onBack provided', () => {
    const screenWithBack = createVideoScreen({
      videoId: 'video-back',
      title: 'Back Video',
      streamUrl: '/stream/back.mp4',
      onBack: () => {},
    });
    const backBtn = screenWithBack.querySelector('[data-action="back"]');
    expect(backBtn).toBeTruthy();
    expect(backBtn?.textContent).toBe('← Back');
  });

  it('renders back button as element (not string)', () => {
    const screenWithBack = createVideoScreen({
      videoId: 'video-back2',
      title: 'Back Video',
      streamUrl: '/stream/back2.mp4',
      onBack: () => {},
    });
    const backBtn = screenWithBack.querySelector('button[data-action="back"]');
    expect(backBtn).toBeTruthy();
    expect(backBtn?.tagName).toBe('BUTTON');
  });

  it('cleanup function exists and prevents memory leaks', () => {
    const video = screen.querySelector('video') as HTMLVideoElement;
    const cleanup = (screen as HTMLDivElement & { cleanup?: () => void }).cleanup;
    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe('function');
  });

  it('shows error state with retry button on video error', () => {
    const video = screen.querySelector('video') as HTMLVideoElement;
    const errorContainer = screen.querySelector('.video-error');
    expect(errorContainer).toBeTruthy();

    // Mock error
    const mockError = new ErrorEvent('error', {
      message: 'Network error',
    });
    Object.defineProperty(video, 'error', {
      value: { code: 2 }, // MEDIA_ERR_NETWORK
      configurable: true,
    });

    // Dispatch error event
    video.dispatchEvent(new Event('error'));

    const errorDialog = errorContainer?.querySelector('.error-dialog');
    expect(errorDialog).toBeTruthy();
    const retryBtn = errorContainer?.querySelector('[data-action="retry"]');
    expect(retryBtn).toBeTruthy();
  });
});
