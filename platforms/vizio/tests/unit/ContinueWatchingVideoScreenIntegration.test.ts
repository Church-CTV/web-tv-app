/**
 * Vizio ContinueWatchingVideoScreenIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContinueWatchingScreen } from '../../../../shared/ui/ContinueWatchingScreen';
import { renderVideoScreen } from '../../../../shared/ui/VideoScreen';

describe('ContinueWatchingVideoScreenIntegration', () => {
  it('renders continue watching with items', () => {
    const html = renderContinueWatchingScreen({
      items: [
        { videoId: 'v1', title: 'Video 1', position: 120, duration: 600, thumbnail: '/t.jpg' },
      ],
    });
    expect(html).toContain('Video 1');
  });

  it('renders video screen', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Video 1',
      streamUrl: '/stream/v1.mp4',
      duration: 600,
    });
    expect(html).toContain('video-screen');
    expect(html).toContain('video-v1');
  });

  it('renders continue watching with multiple items', () => {
    const html = renderContinueWatchingScreen({
      items: [
        { videoId: 'v1', title: 'V1', position: 120, duration: 600, thumbnail: '/t.jpg' },
        { videoId: 'v2', title: 'V2', position: 300, duration: 1200, thumbnail: '/t.jpg' },
      ],
    });
    expect(html).toContain('V1');
    expect(html).toContain('V2');
  });
});
