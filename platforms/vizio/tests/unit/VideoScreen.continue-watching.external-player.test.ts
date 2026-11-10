/**
 * Vizio VideoScreen — Basic unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '../../../../shared/ui/VideoScreen';

describe('Vizio VideoScreen', () => {
  it('renders video screen HTML', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('video-screen');
  });

  it('renders video element with controls', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('<video');
    expect(html).toContain('controls');
  });

  it('renders with custom duration', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
      duration: 1800,
    });
    expect(html).toContain('30:00');
  });

  it('renders with default duration when not provided', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('0:00 / 0:00');
  });

  it('renders video with autoplay', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('autoplay');
  });

  it('renders unique video ID per video', () => {
    const html = renderVideoScreen({
      videoId: 'unique-id',
      title: 'Test',
      streamUrl: '/stream/unique.mp4',
    });
    expect(html).toContain('video-unique-id');
  });
});
