/**
 * L3b — Image failure graceful degradation (webOS ContentCard).
 *
 * The webOS platform uses DOM APIs (not HTML strings) to build ContentCards.
 * A broken poster URL must hide the broken image and reveal a branded fallback.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContentCard, updateContentCard } from '../../src/ui/ContentCard';

describe('L3b - webOS ContentCard image failure graceful degradation', () => {
  let card: HTMLDivElement;

  beforeEach(() => {
    card = createContentCard({
      videoId: 'video-123',
      title: 'Test Video',
      thumbnail: 'https://cdn.example.com/poster.jpg',
    });
  });

  it('has a fallback element present in the card DOM', () => {
    const fallback = card.querySelector('.content-card__poster-fallback');
    expect(fallback).toBeTruthy();
  });

  it('fallback element is aria-hidden (decorative, not a text alternative)', () => {
    const fallback = card.querySelector('.content-card__poster-fallback');
    expect(fallback?.getAttribute('aria-hidden')).toBe('true');
  });

  it('img element has an error handler to hide the broken image', () => {
    const img = card.querySelector('img');
    expect(img).toBeTruthy();
    // The error handler hides the img element on load failure.
    // We test this by dispatching an error event and checking the result.
    const imgEl = img as HTMLImageElement;
    imgEl.src = '';
    imgEl.dispatchEvent(new ErrorEvent('error'));
    expect(imgEl.style.display).toBe('none');
  });

  it('img element has loading=lazy for performance', () => {
    const img = card.querySelector('img');
    expect(img?.loading).toBe('lazy');
  });

  it('error handler marks poster as error so CSS reveals the fallback', () => {
    const img = card.querySelector('img') as HTMLImageElement;
    const poster = img.parentElement as HTMLElement;
    // Dispatch a second error to trigger the poster error class
    img.src = '';
    img.dispatchEvent(new ErrorEvent('error'));
    expect(poster.classList.contains('content-card__poster--error')).toBe(true);
    // The fallback is hidden by default (display:none) and shown by the --error class
    const fallback = card.querySelector('.content-card__poster-fallback');
    expect(fallback).toBeTruthy();
  });

  it('updateContentCard preserves the fallback element when updating', () => {
    updateContentCard(card, {
      videoId: 'video-new',
      title: 'Updated Title',
      thumbnail: 'https://cdn.example.com/new-poster.jpg',
    });
    const fallback = card.querySelector('.content-card__poster-fallback');
    expect(fallback).toBeTruthy();
    // The new img has a fresh error listener. Test it works.
    const img = card.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('new-poster.jpg');
    // Now simulate an error
    img.src = '';
    img.dispatchEvent(new ErrorEvent('error'));
    expect(img.style.display).toBe('none');
  });

  it('thumbnail container has a class for poster styling', () => {
    const thumbnail = card.querySelector('.content-card__thumbnail, .content-card__poster');
    expect(thumbnail).toBeTruthy();
  });
});
