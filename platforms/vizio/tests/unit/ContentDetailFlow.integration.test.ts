/**
 * Vizio ContentDetailFlow Integration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentDetail } from '../../../../shared/ui/ContentDetail';

describe('Vizio ContentDetailFlow Integration', () => {
  it('renders play button with action', () => {
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

  it('renders content detail with metadata', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: 'A long description here',
      thumbnail: '/thumb.jpg',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('Test Video');
    expect(html).toContain('A long description');
  });
});
