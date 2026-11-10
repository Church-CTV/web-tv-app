/**
 * Tizen VideoScreen External Player — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '../../../../shared/ui/VideoScreen';

describe('Tizen VideoScreen External Player', () => {
  it('renders video screen with controls', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('video-screen');
    expect(html).toContain('video-v1');
  });

  it('renders with duration', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
      duration: 3600,
    });
    expect(html).toContain('1:00:00');
  });

  it('renders video element with src', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('/stream/v1.mp4');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
  });

  it('renders progress bar', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('video-screen__progress');
    expect(html).toContain('video-screen__progress-bar');
  });

  it('renders time display', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
      duration: 1800,
    });
    expect(html).toContain('video-screen__time');
    expect(html).toContain('30:00');
  });

  it('renders autoplay attribute', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('autoplay');
  });
});
