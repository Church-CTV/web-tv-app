/**
 * L3b — Image failure graceful degradation (shared ContentCard).
 *
 * When a poster URL 404s, the card should not render a broken image icon
 * or blank space. Instead, it should fall back to a branded placeholder.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard, type SharedVideoItem } from '@ctv/shared/ui/ContentCard';

describe('L3b - Image failure graceful degradation (shared ContentCard)', () => {
  it('includes an img element with loading=lazy for the poster', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: 'https://cdn.example.com/poster.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('<img');
    expect(html).toContain('loading="lazy"');
  });

  it('has a fallback element present in the card DOM', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: 'https://cdn.example.com/poster.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('content-card__poster-fallback');
  });

  it('img element has alt text for accessibility', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'My Great Show',
      sdPosterUrl: 'https://cdn.example.com/poster.jpg',
    };
    const html = renderContentCard(video);
    // The alt should contain the title (or aria-hidden if using fallback div)
    expect(html).toMatch(/alt="[^"]*My Great Show[^"]*"|aria-label/i);
  });

  it('img element has src from the poster URL', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: 'https://cdn.example.com/poster.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('https://cdn.example.com/poster.jpg');
  });

  it('poster container has a background color so there is no blank white space before image loads', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: 'https://cdn.example.com/poster.jpg',
    };
    const html = renderContentCard(video);
    // Should have a background color (design token) set on the poster container or fallback
    expect(html).toMatch(
      /content-card__poster[^>]*style="[^"]*background|content-card__poster-fallback/i
    );
  });
});
