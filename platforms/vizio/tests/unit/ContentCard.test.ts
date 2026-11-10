/**
 * Vizio ContentCard — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard } from '../../../../shared/ui/ContentCard';
import type { SharedVideoItem } from '../../../../shared/ui/ContentCard';

describe('Vizio ContentCard', () => {
  it('renders card with title and poster', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test Video', sdPosterUrl: '/thumb.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('content-card');
    expect(html).toContain('Test Video');
    expect(html).toContain('v1');
  });

  it('renders description when provided', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', shortDescription: 'A description' };
    const html = renderContentCard(video);
    expect(html).toContain('A description');
    expect(html).toContain('content-card__description');
  });

  it('renders duration', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 3661 };
    const html = renderContentCard(video);
    expect(html).toContain('1h 1m');
  });

  it('renders short duration in minutes', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 60 };
    const html = renderContentCard(video);
    expect(html).toContain('1m');
  });

  it('renders without duration when 0', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 0 };
    const html = renderContentCard(video);
    expect(html).not.toContain('content-card__duration');
  });

  it('escapes HTML in title', () => {
    const video: SharedVideoItem = { id: 'xss', title: '<b>Bold</b>' };
    const html = renderContentCard(video);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('uses hdPosterUrl over sdPosterUrl', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      hdPosterUrl: '/hd.jpg',
      sdPosterUrl: '/sd.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('/hd.jpg');
    expect(html).not.toContain('/sd.jpg');
  });

  it('falls back to thumbnail when no poster URLs', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', thumbnail: '/thumb.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('/thumb.jpg');
  });

  it('renders with progress indicator', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: '/t.jpg',
      content: { videos: [{ url: '/stream.mp4' }] },
    };
    const html = renderContentCard(video);
    expect(html).toContain('data-progress="1"');
  });
});
