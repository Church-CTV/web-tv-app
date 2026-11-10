/**
 * WebOS ContentCard UI component — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContentCard, updateContentCard, setFocusState } from '../../src/ui/ContentCard';

describe('ContentCard', () => {
  let card: HTMLDivElement;

  beforeEach(() => {
    card = createContentCard({
      videoId: 'video-123',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumb.jpg',
    });
  });

  it('creates a card with correct attributes', () => {
    expect(card.className).toBe('content-card');
    expect(card.getAttribute('data-video-id')).toBe('video-123');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toBe('Play Test Video');
  });

  it('renders thumbnail', () => {
    const img = card.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('thumb.jpg');
    expect(img?.alt).toBe('Test Video');
  });

  it('renders title', () => {
    const title = card.querySelector('.content-card__title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('Test Video');
  });

  it('does not render progress bar when progress is 0', () => {
    const progress = card.querySelector('.content-card__progress');
    expect(progress).toBeFalsy();
  });

  it('renders progress bar when progress > 0', () => {
    const cardWithProgress = createContentCard({
      videoId: 'video-456',
      title: 'Progress Video',
      thumbnail: 'https://example.com/thumb2.jpg',
      progress: 50,
    });
    const progress = cardWithProgress.querySelector(
      '.content-card__progress'
    ) as HTMLElement | null;
    expect(progress).toBeTruthy();
    expect(progress?.style.width).toBe('50%');
  });

  it('sets active state when isActive is true', () => {
    const activeCard = createContentCard({
      videoId: 'video-789',
      title: 'Active Video',
      thumbnail: 'https://example.com/thumb3.jpg',
      isActive: true,
    });
    expect(activeCard.classList.contains('content-card--active')).toBe(true);
  });

  it('does not set active state when isActive is false', () => {
    expect(card.classList.contains('content-card--active')).toBe(false);
  });

  it('updates card with new data', () => {
    updateContentCard(card, {
      videoId: 'video-new',
      title: 'Updated Title',
      thumbnail: 'https://example.com/new-thumb.jpg',
    });
    expect(card.getAttribute('data-video-id')).toBe('video-new');
    const title = card.querySelector('.content-card__title');
    expect(title?.textContent).toBe('Updated Title');
  });

  it('updates progress bar', () => {
    updateContentCard(card, {
      videoId: 'video-123',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumb.jpg',
      progress: 75,
    });
    const progress = card.querySelector('.content-card__progress') as HTMLElement | null;
    expect(progress).toBeTruthy();
    expect(progress?.style.width).toBe('75%');
  });

  it('removes progress bar when progress is 0', () => {
    const cardWithProgress = createContentCard({
      videoId: 'video-456',
      title: 'Progress Video',
      thumbnail: 'https://example.com/thumb2.jpg',
      progress: 50,
    });
    updateContentCard(cardWithProgress, {
      videoId: 'video-456',
      title: 'Progress Video',
      thumbnail: 'https://example.com/thumb2.jpg',
      progress: 0,
    });
    const progress = cardWithProgress.querySelector('.content-card__progress');
    expect(progress).toBeFalsy();
  });

  it('sets focus state', () => {
    setFocusState(card, true);
    expect(card.classList.contains('content-card--active')).toBe(true);

    setFocusState(card, false);
    expect(card.classList.contains('content-card--active')).toBe(false);
  });
});
