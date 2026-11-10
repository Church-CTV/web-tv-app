/**
 * ContentCard — unit tests for updateContentCard and setFocusState.
 * Tests the update and focus functions that complement createContentCard tests.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createContentCard,
  updateContentCard,
  setFocusState,
  type ContentCardProps,
} from '../../src/ui/ContentCard';

const sampleProps: ContentCardProps = {
  videoId: 'video-1',
  title: 'Test Video',
  thumbnail: 'https://example.com/thumb.jpg',
  progress: 50,
  isActive: true,
};

describe('ContentCard update', () => {
  it('updates videoId attribute', () => {
    const card = createContentCard(sampleProps);
    updateContentCard(card, { ...sampleProps, videoId: 'video-2' });
    expect(card.getAttribute('data-video-id')).toBe('video-2');
  });

  it('updates thumbnail src and alt', () => {
    const card = createContentCard(sampleProps);
    updateContentCard(card, { ...sampleProps, thumbnail: 'https://example.com/new.jpg' });
    const img = card.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('new.jpg');
    expect(img.alt).toBe('Test Video');
  });

  it('updates title text', () => {
    const card = createContentCard(sampleProps);
    updateContentCard(card, { ...sampleProps, title: 'Updated Title' });
    const title = card.querySelector('.content-card__title');
    expect(title?.textContent).toBe('Updated Title');
  });

  it('adds progress bar when progress > 0 and none exists', () => {
    const card = createContentCard({ ...sampleProps, progress: undefined });
    const before = card.querySelector('.content-card__progress');
    expect(before).toBeNull();
    updateContentCard(card, { ...sampleProps });
    const after = card.querySelector('.content-card__progress');
    expect(after).toBeTruthy();
    expect((after as HTMLDivElement).style.width).toBe('50%');
  });

  it('updates existing progress bar width', () => {
    const card = createContentCard(sampleProps);
    updateContentCard(card, { ...sampleProps, progress: 75 });
    const progress = card.querySelector('.content-card__progress');
    expect((progress as HTMLDivElement).style.width).toBe('75%');
  });

  it('removes progress bar when progress is 0', () => {
    const card = createContentCard(sampleProps);
    updateContentCard(card, { ...sampleProps, progress: 0 });
    const progress = card.querySelector('.content-card__progress');
    expect(progress).toBeNull();
  });

  it('removes progress bar when progress is undefined (no bar should be added)', () => {
    const card = createContentCard({ ...sampleProps, progress: undefined });
    updateContentCard(card, { ...sampleProps, progress: undefined });
    const progress = card.querySelector('.content-card__progress');
    expect(progress).toBeNull();
  });
});

describe('ContentCard focus state', () => {
  it('adds active class when focused', () => {
    const card = createContentCard(sampleProps);
    setFocusState(card, true);
    expect(card.classList.contains('content-card--active')).toBe(true);
  });

  it('removes active class when unfocused', () => {
    const card = createContentCard({ ...sampleProps, isActive: true });
    setFocusState(card, false);
    expect(card.classList.contains('content-card--active')).toBe(false);
  });

  it('toggles active class correctly', () => {
    const card = createContentCard(sampleProps);
    setFocusState(card, true);
    expect(card.classList.contains('content-card--active')).toBe(true);
    setFocusState(card, false);
    expect(card.classList.contains('content-card--active')).toBe(false);
    setFocusState(card, true);
    expect(card.classList.contains('content-card--active')).toBe(true);
  });
});
