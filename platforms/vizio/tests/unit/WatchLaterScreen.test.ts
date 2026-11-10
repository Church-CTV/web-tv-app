import { describe, it, expect } from 'vitest';
import { renderWatchLaterScreen } from '../../src/ui/WatchLaterScreen';

describe('WatchLaterScreen', () => {
  it('should render watch later screen', () => {
    const html = renderWatchLaterScreen({ items: [] });

    expect(html).toContain('watch-later-screen');
    expect(html).toContain('Watch Later');
  });

  it('should show empty state when no items', () => {
    const html = renderWatchLaterScreen({ items: [] });

    expect(html).toContain('No items in Watch Later');
  });

  it('should render items with remove buttons', () => {
    const items = [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }];

    const html = renderWatchLaterScreen({
      items,
      onRemove: () => {},
    });

    expect(html).toContain('v1');
    expect(html).toContain('Video 1');
    expect(html).toContain('Remove');
  });

  it('should show clear all button when items exist', () => {
    const items = [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }];

    const html = renderWatchLaterScreen({
      items,
      onRemove: () => {},
      onClearAll: () => {},
    });

    expect(html).toContain('Clear All');
    expect(html).toContain('clear-all');
  });

  it('should not show clear all button when no items', () => {
    const html = renderWatchLaterScreen({ items: [] });

    expect(html).not.toContain('Clear All');
  });
});
