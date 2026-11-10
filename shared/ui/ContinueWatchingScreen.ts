/**
 * Shared ContinueWatchingScreen — renders "Resume Watching" section from continue-watching data.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

import type { SharedVideoItem } from './ContentCard';
import { renderContentCard } from './ContentCard';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ContinueWatchingItem {
  videoId: string;
  title: string;
  position: number;
  duration: number;
  thumbnail?: string;
  hdPosterUrl?: string;
  sdPosterUrl?: string;
}

export interface ContinueWatchingScreenProps {
  items: ContinueWatchingItem[];
  onVideoSelect?: (videoId: string, position: number) => void;
  onBack?: () => void;
}

function formatPosition(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Render the continue watching screen as an HTML string.
 */
export function renderContinueWatchingScreen(props: ContinueWatchingScreenProps): string {
  const { items } = props;

  if (items.length === 0) {
    return '<div class="continue-watching-screen continue-watching-screen--empty" id="continue-watching-screen"><h2 class="continue-watching-screen__title">Continue Watching</h2><div class="continue-watching-screen__empty">No items</div></div>';
  }

  let html = '<div class="continue-watching-screen" id="continue-watching-screen">';
  html += '<h2 class="continue-watching-screen__title">Continue Watching</h2>';
  html += '<div class="content-grid">';

  for (const item of items) {
    // A stored resume point is data, not a guarantee: the Continue Watching store
    // keeps whatever the player last reported, and a feed re-encode can shorten a
    // duration underneath it. Clamp once here, then derive the bar, the remaining
    // label and the seek attribute from the same clamped value so the three can
    // never disagree. Unclamped, a drifted point rendered `width:125%` and
    // `-30s remaining`; a non-finite position rendered `width:NaN%`, which a
    // webview drops and leaves the bar at its previous width.
    // A non-finite duration (a live stream reports Infinity) has no meaningful
    // progress or remaining time, so both are omitted rather than painted as
    // `Infinityh remaining`.
    const live = Number.isFinite(item.duration) && item.duration > 0;
    const position = Number.isFinite(item.position) ? Math.max(0, item.position) : 0;
    const resumeAt = live ? Math.min(position, item.duration) : 0;
    const progress = live ? Math.round((resumeAt / item.duration) * 100) : 0;
    const remaining = live ? item.duration - resumeAt : 0;
    const meta = live
      ? `${formatPosition(position)} · ${formatDuration(remaining)} remaining`
      : formatPosition(position);
    const video: SharedVideoItem = {
      id: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      hdPosterUrl: item.hdPosterUrl,
      sdPosterUrl: item.sdPosterUrl,
    };

    html += `<div class="continue-watching-item" data-video-id="${escapeHtml(item.videoId)}" data-position="${resumeAt}" tabindex="0">`;
    html += '<div class="continue-watching-item__poster">';
    html += renderContentCard(video);
    html += `<div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>`;
    html += '</div>';
    html += '<div class="continue-watching-item__info">';
    html += `<div class="continue-watching-item__title">${escapeHtml(item.title)}</div>`;
    html += `<div class="continue-watching-item__meta">${meta}</div>`;
    html += '</div>';
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

/**
 * Initialize continue watching screen interactivity.
 */
export function initContinueWatchingScreen(props: ContinueWatchingScreenProps): void {
  const { onVideoSelect } = props;
  if (!onVideoSelect) return;

  const container = document.getElementById('continue-watching-screen') as HTMLElement | null;
  if (!container) return;

  const items = container.querySelectorAll('.continue-watching-item') as NodeListOf<HTMLElement>;
  items.forEach((itemEl) => {
    itemEl.addEventListener('click', () => {
      const videoId = itemEl.getAttribute('data-video-id');
      const posStr = itemEl.getAttribute('data-position');
      if (videoId) {
        const position = posStr ? parseFloat(posStr) : 0;
        onVideoSelect(videoId, position);
      }
    });
  });
}
