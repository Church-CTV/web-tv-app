/**
 * Vizio ContentDetailFlow — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentDetail } from '../../../../shared/ui/ContentDetail';

describe('Vizio ContentDetailFlow', () => {
  it('renders play button', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onPlay: () => {},
    });
    expect(html).toContain('btn-play');
  });

  it('renders watch later button', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: '',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
      onWatchLater: () => {},
    });
    expect(html).toContain('btn-watch-later');
  });

  it('renders content detail without actions', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: 'desc',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('content-detail');
  });
});
