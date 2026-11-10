/**
 * Tizen ContentGrid — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentGrid } from '../../../../shared/ui/ContentGrid';
import { attachPosterFallbacks, initContentGrid } from '../../src/ui/ContentGrid';
import { renderContentCard } from '../../../../shared/ui/ContentCard';
import type { ContentGridCategory } from '../../../../shared/ui/ContentGrid';

describe('Tizen ContentGrid', () => {
  it('renders grid with categories', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat1',
        name: 'Category 1',
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
    expect(html).toContain('Category 1');
    expect(html).toContain('v1');
  });

  it('skips empty categories', () => {
    const cats: ContentGridCategory[] = [{ id: 'empty', name: 'Empty', videos: [] }];
    const html = renderContentGrid({ categories: cats });
    expect(html).not.toContain('Empty');
  });

  it('renders multiple category rows', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat1', name: 'Animals', videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }] },
      { id: 'cat2', name: 'Nature', videos: [{ id: 'v2', title: 'V2', sdPosterUrl: '/t.jpg' }] },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('Animals');
    expect(html).toContain('Nature');
    expect(html).toContain('v1');
    expect(html).toContain('v2');
  });

  it('renders category sections with data attributes', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'my-cat',
        name: 'My Category',
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('data-category-id="my-cat"');
  });

  it('renders content cards with video IDs', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat1', name: 'Cat', videos: [{ id: 'unique-id', title: 'V', sdPosterUrl: '/t.jpg' }] },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('data-video-id="unique-id"');
  });

  it('renders multiple videos per category', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat1',
        name: 'Cat',
        videos: [
          { id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' },
          { id: 'v2', title: 'V2', sdPosterUrl: '/t.jpg' },
          { id: 'v3', title: 'V3', sdPosterUrl: '/t.jpg' },
        ],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('V1');
    expect(html).toContain('V2');
    expect(html).toContain('V3');
  });

  it('handles categories with no videos gracefully', () => {
    const cats: ContentGridCategory[] = [
      { id: 'a', name: 'A', videos: [] },
      { id: 'b', name: 'B', videos: [] },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
  });
});

describe('Tizen ContentGrid poster degradation (webOS L3b parity)', () => {
  // webOS reference (ui/ContentCard.ts) hides a failing poster <img> so the
  // branded fallback tile shows instead of the browser broken-image icon and
  // alt text. Tizen reaches the same end state via attachPosterFallbacks.
  function mountCard(thumb: string): HTMLDivElement {
    const host = document.createElement('div');
    host.innerHTML = renderContentCard({ id: 'v1', title: 'Poster Case', hdPosterUrl: thumb });
    return host;
  }

  function setBroken(img: HTMLImageElement): void {
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 0, configurable: true });
  }

  it('hides an already-failed poster and flags the poster tile', () => {
    const host = mountCard('/gone.jpg');
    const img = host.querySelector<HTMLImageElement>('.content-card__poster-img')!;
    setBroken(img);
    attachPosterFallbacks(host);
    expect(img.style.display).toBe('none');
    expect(
      host.querySelector('.content-card__poster')!.classList.contains('content-card__poster--error')
    ).toBe(true);
  });

  it('degrades when the error event fires after wiring', () => {
    const host = mountCard('/late.jpg');
    const img = host.querySelector<HTMLImageElement>('.content-card__poster-img')!;
    attachPosterFallbacks(host);
    expect(img.style.display).toBe('');
    setBroken(img);
    img.dispatchEvent(new Event('error'));
    expect(img.style.display).toBe('none');
  });

  it('leaves healthy posters visible', () => {
    const host = mountCard('/good.jpg');
    const img = host.querySelector<HTMLImageElement>('.content-card__poster-img')!;
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 640, configurable: true });
    attachPosterFallbacks(host);
    expect(img.style.display).toBe('');
  });

  it('is idempotent across repeated attach calls', () => {
    const host = mountCard('/twice.jpg');
    attachPosterFallbacks(host);
    attachPosterFallbacks(host);
    const img = host.querySelector<HTMLImageElement>('.content-card__poster-img')!;
    setBroken(img);
    img.dispatchEvent(new Event('error'));
    expect(img.style.display).toBe('none');
  });

  it('initContentGrid arms degradation for every rendered card', () => {
    const container = document.createElement('div') as HTMLDivElement;
    container.innerHTML = renderContentGrid({
      categories: [
        { id: 'm', name: 'M', videos: [{ id: 'x', title: 'X', hdPosterUrl: '/x.jpg' }] },
      ],
    });
    initContentGrid(container, () => {});
    const img = container.querySelector<HTMLImageElement>('.content-card__poster-img')!;
    setBroken(img);
    img.dispatchEvent(new Event('error'));
    expect(img.style.display).toBe('none');
  });
});
