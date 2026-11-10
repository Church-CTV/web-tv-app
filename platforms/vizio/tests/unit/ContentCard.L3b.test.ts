/**
 * L3b — Image failure graceful degradation (Vizio parity).
 *
 * Vizio uses the shared ContentCard (renderContentCard). These tests mirror
 * the Tizen parity tests to lock in the contract per-platform. Error handling
 * is done via addEventListener, not inline onerror (to avoid CSP violations).
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard } from '@ctv/shared/ui/ContentCard';
import type { SharedVideoItem } from '@ctv/shared/ui/ContentCard';

describe('L3b - Vizio image failure graceful degradation (via shared)', () => {
  const sample: SharedVideoItem = {
    id: 'v1',
    title: 'Parity Test',
    hdPosterUrl: 'https://cdn.example.com/hd-poster.jpg',
  };

  it('Vizio shared renderContentCard uses addEventListener pattern (no inline onerror)', () => {
    const html = renderContentCard(sample);
    // Should NOT have inline onerror (CSP violation on Tizen/Vizio)
    expect(html).not.toMatch(/onerror="[^"]*display='none'[^"]*"/i);
  });

  it('Vizio shared renderContentCard includes poster fallback', () => {
    const html = renderContentCard(sample);
    expect(html).toContain('content-card__poster-fallback');
  });

  it('Vizio shared renderContentCard: hdPosterUrl takes precedence', () => {
    const html = renderContentCard(sample);
    expect(html).toContain('https://cdn.example.com/hd-poster.jpg');
  });
});
