/**
 * Vizio ContinueWatchingIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContinueWatchingScreen } from '../../../../shared/ui/ContinueWatchingScreen';
import type { ContinueWatchingItem } from '../../../../shared/ui/ContinueWatchingScreen';

describe('Vizio ContinueWatchingIntegration', () => {
  it('renders continue watching screen', () => {
    const html = renderContinueWatchingScreen({ items: [] });
    expect(html).toContain('continue-watching-screen');
    expect(html).toContain('Continue Watching');
  });

  it('renders empty state', () => {
    const html = renderContinueWatchingScreen({ items: [] });
    expect(html).toContain('No items');
  });

  it('renders items with progress', () => {
    const items: ContinueWatchingItem[] = [
      { videoId: 'v1', title: 'Video 1', position: 1800, duration: 3600 },
    ];
    const html = renderContinueWatchingScreen({ items });
    expect(html).toContain('Video 1');
    expect(html).toContain('50%');
  });

  it('renders multiple items', () => {
    const items: ContinueWatchingItem[] = [
      { videoId: 'v1', title: 'Video 1', position: 1800, duration: 3600 },
      { videoId: 'v2', title: 'Video 2', position: 600, duration: 1800 },
    ];
    const html = renderContinueWatchingScreen({ items });
    expect(html).toContain('Video 1');
    expect(html).toContain('Video 2');
  });
});
