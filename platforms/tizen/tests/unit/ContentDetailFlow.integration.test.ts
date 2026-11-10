/**
 * Tizen ContentDetailFlow integration — ContentDetail→VideoScreen play flow.
 */

import { describe, it, expect } from 'vitest';
import { renderContentDetail } from '../../../../shared/ui/ContentDetail';
import { renderVideoScreen } from '../../../../shared/ui/VideoScreen';

describe('ContentDetailFlow', () => {
  it('renders play button', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Video',
      description: '',
      thumbnail: '/t.jpg',
      streamUrl: '/s.mp4',
      onPlay: () => {},
    });
    expect(html).toContain('btn-play');
  });

  it('renders video screen after play', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Video',
      streamUrl: '/s.mp4',
      duration: 3600,
    });
    expect(html).toContain('video-screen');
    expect(html).toContain('1:00:00');
  });

  it('renders content detail without actions', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Video',
      description: '',
      thumbnail: '/t.jpg',
      streamUrl: '/s.mp4',
    });
    expect(html).toContain('content-detail');
    expect(html).not.toContain('btn-play');
  });
});
