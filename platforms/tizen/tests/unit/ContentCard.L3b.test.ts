/**
 * L3b — Image failure graceful degradation (Tizen/Vizio parity).
 *
 * Both platforms use the shared ContentCard (renderContentCard). These tests
 * assert that the shared implementation degrades gracefully on all platforms
 * that consume it. Error handling is done via addEventListener, not inline
 * onerror (to avoid CSP violations on Tizen/Vizio).
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard } from '@ctv/shared/ui/ContentCard';
import type { SharedVideoItem } from '@ctv/shared/ui/ContentCard';

describe('L3b - Tizen/Vizio image failure graceful degradation (via shared)', () => {
  const sample: SharedVideoItem = {
    id: 'v1',
    title: 'Parity Test',
    sdPosterUrl: 'https://cdn.example.com/poster.jpg',
  };

  it('shared renderContentCard uses addEventListener pattern (no inline onerror)', () => {
    const html = renderContentCard(sample);
    // Should NOT have inline onerror (CSP violation on Tizen/Vizio)
    expect(html).not.toMatch(/onerror="[^"]*display='none'[^"]*"/i);
  });

  it('shared renderContentCard includes the poster fallback element', () => {
    const html = renderContentCard(sample);
    expect(html).toContain('content-card__poster-fallback');
  });

  it('shared renderContentCard includes aria-hidden on fallback', () => {
    const html = renderContentCard(sample);
    expect(html).toMatch(/content-card__poster-fallback[^>]*aria-hidden="true"/);
  });

  it('shared renderContentCard uses img element with loading=lazy', () => {
    const html = renderContentCard(sample);
    expect(html).toMatch(/<img[^>]*loading="lazy"/);
  });

  it('shared renderContentCard: no poster URL still renders fallback', () => {
    const html = renderContentCard({ id: 'v2', title: 'No Poster' });
    expect(html).toContain('content-card__poster-fallback');
    // No img element when no poster URL.
    expect(html).not.toContain('<img');
  });
});
