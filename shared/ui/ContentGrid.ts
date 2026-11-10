/**
 * Shared ContentGrid — renders content organized by category/month.
 * Used by all three platforms.
 */

import { renderContentCard } from './ContentCard';
import type { SharedVideoItem } from './ContentCard';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ContentGridCategory {
  id: string;
  name: string;
  videos: SharedVideoItem[];
}

export interface ContentGridProps {
  categories: ContentGridCategory[];
  onVideoSelect?: (videoId: string) => void;
}

export function renderContentGrid(props: ContentGridProps): string {
  const { categories } = props;

  let html = '<div class="main-grid">';

  for (const category of categories) {
    if (category.videos.length === 0) continue;

    html += `<section class="content-category" data-category-id="${escapeHtml(category.id)}">
      <h2 class="content-category__title">${escapeHtml(category.name)}</h2>
      <div class="content-category__row" role="group" aria-label="${escapeHtml(category.name)}">`;

    for (const video of category.videos) {
      html += renderContentCard(video);
    }

    html += '</div></section>';
  }

  html += '</div>';

  return html;
}

export function initContentGrid(
  container: HTMLDivElement,
  onVideoSelect?: (videoId: string) => void
): void {
  if (!onVideoSelect) return;

  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('[data-video-id]');
    if (card) {
      e.preventDefault();
      onVideoSelect(card.getAttribute('data-video-id') || '');
    }
  });

  // Focus management for D-pad
  container.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const focused = document.activeElement;
    if (!focused) return;
    const card = focused.closest('[data-video-id]');
    if (!card) return;

    const row = card.parentElement;
    if (!row || !row.classList.contains('content-category__row')) return;

    const cards = Array.from(row.querySelectorAll('[data-video-id]'));
    const idx = cards.indexOf(card as Element);

    if (e.key === 'ArrowRight' && idx < cards.length - 1) {
      e.preventDefault();
      (cards[idx + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      (cards[idx - 1] as HTMLElement).focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onVideoSelect(card.getAttribute('data-video-id') || '');
    }
  });
}

export function focusFirstCard(container: HTMLDivElement): void {
  const firstCard = container.querySelector('[data-video-id]');
  if (firstCard) (firstCard as HTMLElement).focus();
}
