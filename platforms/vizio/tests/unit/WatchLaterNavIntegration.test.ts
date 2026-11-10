/**
 * Vizio WatchLaterNavIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderWatchLaterScreen } from '../../../../shared/ui/WatchLaterScreen';

describe('Vizio WatchLaterNavIntegration', () => {
  it('renders watch later screen with items', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }],
    });
    expect(html).toContain('watch-later');
    expect(html).toContain('Video 1');
  });

  it('shows empty state when no items', () => {
    const html = renderWatchLaterScreen({ items: [] });
    expect(html).toContain('No items in Watch Later');
  });

  it('renders items with remove buttons', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }],
      onRemove: () => {},
    });
    expect(html).toContain('Video 1');
    expect(html).toContain('Remove');
  });

  it('shows clear all button when items exist', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }],
      onRemove: () => {},
      onClearAll: () => {},
    });
    expect(html).toContain('Clear All');
  });

  it('does not show clear all button when no items', () => {
    const html = renderWatchLaterScreen({ items: [] });
    expect(html).not.toContain('Clear All');
  });
});
