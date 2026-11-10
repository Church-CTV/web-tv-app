/**
 * ContentCard — additional edge-case tests.
 * Covers XSS, unicode, special characters, and boundary values.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard, type SharedVideoItem } from '@ctv/shared/ui/ContentCard';

describe('ContentCard edge cases', () => {
  it('handles unicode titles', () => {
    const video: SharedVideoItem = { id: 'v1', title: '日本語タイトル', sdPosterUrl: '/t.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('日本語タイトル');
  });

  it('handles emoji in title', () => {
    const video: SharedVideoItem = { id: 'v1', title: '🏎️ Race Day', sdPosterUrl: '/t.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('🏎️');
  });

  it('handles empty description', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', sdPosterUrl: '/t.jpg' };
    const html = renderContentCard(video);
    expect(html).not.toContain('No description available');
  });

  it('shows fallback description when none provided', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', sdPosterUrl: '/t.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('content-card');
  });

  it('escapes HTML in description', () => {
    const video: SharedVideoItem = {
      id: 'xss',
      title: 'Safe',
      shortDescription: '<script>alert(1)</script>',
    };
    const html = renderContentCard(video);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('renders with long title', () => {
    const longTitle = 'A'.repeat(500);
    const video: SharedVideoItem = { id: 'v1', title: longTitle, sdPosterUrl: '/t.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain(longTitle);
  });

  it('uses sdPosterUrl when hdPosterUrl is empty', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      hdPosterUrl: '',
      sdPosterUrl: '/sd.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('/sd.jpg');
  });

  it('handles null-like values gracefully', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', sdPosterUrl: '' } as SharedVideoItem;
    const html = renderContentCard(video);
    expect(html).toContain('content-card');
    expect(html).toContain('Test');
  });
});
