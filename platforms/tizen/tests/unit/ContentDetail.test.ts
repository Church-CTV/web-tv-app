/**
 * Tizen ContentDetail — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentDetail } from '../../../../shared/ui/ContentDetail';

describe('Tizen ContentDetail', () => {
  it('renders content detail with title and description', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: 'A test video description',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('content-detail');
    expect(html).toContain('Test Video');
    expect(html).toContain('A test video description');
  });

  it('renders play button when onPlay callback provided', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onPlay: () => {},
    });
    expect(html).toContain('btn-play');
    expect(html).toContain('Play');
  });

  it('renders watch later button when onWatchLater callback provided', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onWatchLater: () => {},
    });
    expect(html).toContain('btn-watch-later');
    expect(html).toContain('Watch Later');
  });

  it('handles empty description', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).not.toContain('<p');
    expect(html).toContain('Test Video');
  });

  it('escapes HTML in title', () => {
    const html = renderContentDetail({
      videoId: 'xss',
      title: '<script>alert(1)</script>',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/xss.mp4',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
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
    expect(html).not.toContain('btn-play');
    expect(html).not.toContain('btn-watch-later');
  });
});
