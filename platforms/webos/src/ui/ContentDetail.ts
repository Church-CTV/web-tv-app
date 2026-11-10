/**
 * ContentDetail — main view equivalent: large poster, metadata, action buttons.
 * Mirrors Roku's ContentDetail component.
 */

import type { VideoItem } from '@ctv/core/feed/FeedParser';
import { escapeHtml, escapeAttr } from '../utils/HtmlEscape';
import { getPlatformI18n } from '../utils/PlatformI18n';

export interface ContentDetailCallbacks {
  onPlay?: () => void;
}

/**
 * Create a ContentDetail component.
 * Renders a large poster, title, metadata, and action buttons.
 * Returns the root element for mounting into the screen container.
 */
export function createContentDetail(
  video: VideoItem,
  callbacks?: ContentDetailCallbacks
): HTMLElement & { cleanup: () => void } {
  const container = document.createElement('div');
  container.className = 'content-detail';
  container.id = 'content-detail';

  const posterUrl = video.hdPosterUrl || video.sdPosterUrl || video.thumbnail || '';
  const duration = video.content?.duration ? formatDuration(video.content.duration) : '';
  const genres = (video.genres || []).map((g) => escapeHtml(g)).join(' · ');

  // Hero poster area
  const posterDiv = document.createElement('div');
  posterDiv.className = 'content-detail__poster';
  if (posterUrl) {
    posterDiv.style.backgroundImage = `url('${escapeAttr(posterUrl)}')`;
  }

  // Info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'content-detail__info';

  // Title
  const titleEl = document.createElement('h1');
  titleEl.className = 'content-detail__title';
  titleEl.textContent = escapeHtml(video.title || '');
  infoDiv.appendChild(titleEl);

  // Genres
  if (genres) {
    const genresEl = document.createElement('div');
    genresEl.className = 'content-detail__genres';
    genresEl.textContent = genres;
    infoDiv.appendChild(genresEl);
  }

  // Duration
  if (duration) {
    const durationEl = document.createElement('div');
    durationEl.className = 'content-detail__duration';
    durationEl.textContent = duration;
    infoDiv.appendChild(durationEl);
  }

  // Description
  if (video.shortDescription) {
    const descEl = document.createElement('div');
    descEl.className = 'content-detail__description';
    descEl.textContent = video.shortDescription;
    infoDiv.appendChild(descEl);
  }

  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'content-detail__actions';

  // Store handlers for cleanup
  const handlers: Array<{ el: HTMLElement; event: string; cb: EventListener }> = [];

  const playBtn = document.createElement('button');
  playBtn.className = 'content-detail__btn content-detail__btn--play';
  playBtn.id = 'btn-play';
  playBtn.tabIndex = 0;
  playBtn.setAttribute('aria-label', `Play ${video.title || ''}`);
  playBtn.textContent = getPlatformI18n().t('action.play');
  const playHandler = () => callbacks?.onPlay?.();
  playBtn.addEventListener('click', playHandler);
  handlers.push({ el: playBtn, event: 'click', cb: playHandler });
  actionsDiv.appendChild(playBtn);

  infoDiv.appendChild(actionsDiv);
  container.appendChild(posterDiv);
  container.appendChild(infoDiv);

  // Cleanup function
  const cleanup = () => {
    handlers.forEach(({ el, event, cb }) => {
      el.removeEventListener(event, cb);
    });
  };

  return Object.assign(container, { cleanup }) as HTMLElement & { cleanup: () => void };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
