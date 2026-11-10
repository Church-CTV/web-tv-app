import { describe, it, expect } from 'vitest';
import { renderContinueWatchingScreen } from '../../src/ui/ContinueWatchingScreen';

describe('ContinueWatchingScreen', () => {
  it('should render continue watching screen', () => {
    const html = renderContinueWatchingScreen({ items: [] });

    expect(html).toContain('continue-watching-screen');
    expect(html).toContain('Continue Watching');
  });

  it('should show empty state when no items', () => {
    const html = renderContinueWatchingScreen({ items: [] });

    expect(html).toContain('No items');
  });

  it('should render items with progress', () => {
    const items = [
      {
        videoId: 'v1',
        title: 'Video 1',
        position: 1800,
        duration: 3600,
        thumbnail: '/v1.jpg',
      },
    ];

    const html = renderContinueWatchingScreen({ items });

    expect(html).toContain('50%');
    expect(html).toContain('Video 1');
    expect(html).toContain('v1');
  });

  it('should handle items with no duration', () => {
    const items = [
      {
        videoId: 'v2',
        title: 'Video 2',
        position: 100,
        duration: 0,
        thumbnail: '/v2.jpg',
      },
    ];

    const html = renderContinueWatchingScreen({ items });

    expect(html).toContain('0%');
    expect(html).not.toContain('NaN');
  });
});
