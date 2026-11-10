/**
 * Shared WatchLaterScreen — renders the "Watch Later" queue.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

import type { SharedVideoItem } from './ContentCard';
import { renderContentCard } from './ContentCard';
import { createConfirmDialog, showConfirmDialog } from './ConfirmDialog';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface WatchLaterItem {
  videoId: string;
  title: string;
  addedAt: string;
  thumbnail?: string;
  hdPosterUrl?: string;
  sdPosterUrl?: string;
}

export interface WatchLaterScreenProps {
  items: WatchLaterItem[];
  onVideoSelect?: (videoId: string) => void;
  onRemove?: (videoId: string) => void;
  onClearAll?: () => void;
  onBack?: () => void;
}

/**
 * Render the watch later screen as an HTML string.
 */
export function renderWatchLaterScreen(props: WatchLaterScreenProps): string {
  const { items } = props;

  if (items.length === 0) {
    return '<div class="watch-later-screen watch-later-screen--empty" id="watch-later-screen"><h2 class="watch-later-screen__title">Watch Later</h2><div class="watch-later-screen__empty">No items in Watch Later.</div></div>';
  }

  let html = '<div class="watch-later-screen" id="watch-later-screen">';
  html += '<h2 class="watch-later-screen__title">Watch Later</h2>';
  html += '<div class="content-grid">';

  for (const item of items) {
    const date = new Date(item.addedAt).toLocaleDateString();
    const video: SharedVideoItem = {
      id: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      hdPosterUrl: item.hdPosterUrl,
      sdPosterUrl: item.sdPosterUrl,
    };

    html += `<div class="watch-later-item" data-video-id="${escapeHtml(item.videoId)}" tabindex="0">`;
    html += '<div class="watch-later-item__poster">';
    html += renderContentCard(video);
    html += '</div>';
    html += '<div class="watch-later-item__info">';
    html += `<div class="watch-later-item__title">${escapeHtml(item.title || 'Untitled')}</div>`;
    html += `<div class="watch-later-item__meta">Added ${date}</div>`;
    html += '</div>';

    if (props.onRemove) {
      html += `<button class="watch-later-item__remove" data-remove-id="${escapeHtml(item.videoId)}" tabindex="0">Remove</button>`;
    }

    html += '</div>';
  }

  if (props.onClearAll && items.length > 0) {
    html += '<div class="watch-later-screen__actions">';
    html +=
      '<button class="watch-later-screen__clear-all" id="clear-all" tabindex="0">Clear All</button>';
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

/**
 * Initialize watch later screen interactivity.
 */
export function initWatchLaterScreen(props: WatchLaterScreenProps): void {
  const { onVideoSelect, onRemove, onClearAll } = props;

  const container = document.getElementById('watch-later-screen') as HTMLElement | null;
  if (!container) return;

  const itemEls = container.querySelectorAll('.watch-later-item') as NodeListOf<HTMLElement>;
  itemEls.forEach((itemEl) => {
    itemEl.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;

      // Check if the remove button was clicked
      if (onRemove && target.classList.contains('watch-later-item__remove')) {
        const videoId = target.getAttribute('data-remove-id');
        if (videoId) {
          onRemove(videoId);
          return;
        }
      }

      // Otherwise treat as video select
      if (onVideoSelect) {
        const videoId = itemEl.getAttribute('data-video-id');
        if (videoId) {
          onVideoSelect(videoId);
        }
      }
    });
  });

  // Clear all button — K4b: CTV-compatible confirmation dialog
  if (onClearAll) {
    const clearAllBtn = container.querySelector('#clear-all') as HTMLElement | null;
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const dialog = createConfirmDialog({
          title: 'Clear All',
          message: 'Clear all watch later items? This cannot be undone.',
          confirmLabel: 'Clear All',
          cancelLabel: 'Cancel',
        });
        showConfirmDialog(dialog, {
          onConfirm: () => onClearAll(),
        });
      });
    }
  }
}
