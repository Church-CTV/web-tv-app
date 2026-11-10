/**
 * Tizen ContentDetail Flow — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentDetail } from '../../../../shared/ui/ContentDetail';

describe('Tizen ContentDetail Flow', () => {
  it('renders content detail HTML', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: 'A test video',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('content-detail');
    expect(html).toContain('Test Video');
    expect(html).toContain('A test video');
  });

  it('renders play button when callback provided', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onPlay: () => {},
    });
    expect(html).toContain('Play');
    expect(html).toContain('btn-play');
  });

  it('renders watch later button when callback provided', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onWatchLater: () => {},
    });
    expect(html).toContain('Watch Later');
    expect(html).toContain('btn-watch-later');
  });

  it('renders without action buttons when no callbacks', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('content-detail');
  });

  it('handles empty description', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('Test Video');
  });

  it('handles missing thumbnail', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('content-detail');
  });
});
