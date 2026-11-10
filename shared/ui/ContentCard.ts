/**
 * Shared ContentCard — renders a single video card.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

function escapeHtml(str?: string): string {
  const s = str || '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str?: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export interface SharedVideoItem {
  id: string;
  title: string;
  shortDescription?: string;
  thumbnail?: string;
  hdPosterUrl?: string;
  sdPosterUrl?: string;
  sdPosterLowUrl?: string;
  sdVideoThumbnailUrl?: string;
  hdVideoThumbnailUrl?: string;
  duration?: number;
  isLive?: boolean;
  content?: { duration?: number; videos?: Array<{ url: string; quality?: string }> };
}

export function renderContentCard(video: SharedVideoItem): string {
  const posterUrl = video.hdPosterUrl || video.sdPosterUrl || video.thumbnail || '';
  const desc = video.shortDescription || '';
  const duration = video.duration || video.content?.duration || 0;
  const formattedDuration = formatDuration(duration);
  const progress = video.content?.videos ? '1' : '0';
  const altText = escapeAttr(video.title);
  const cardId = `card-${escapeAttr(video.id)}`;

  const posterContent = posterUrl
    ? `<img id="${cardId}-img" class="content-card__poster-img" src="${escapeAttr(posterUrl)}" alt="${altText}" loading="lazy" />`
    : '';

  return `<div class="content-card${video.isLive ? ' content-card--live' : ''}" data-video-id="${escapeAttr(video.id)}" data-progress="${progress}" role="button" aria-label="${altText}" tabindex="0">
    <div class="content-card__poster" id="${cardId}-poster">
      <div class="content-card__poster-fallback" aria-hidden="true"></div>
      ${posterContent}
      ${video.isLive ? '<span class="content-card__live">Live</span>' : ''}
    </div>
    <div class="content-card__info">
      <h3 class="content-card__title">${escapeHtml(video.title)}</h3>
      ${desc ? `<p class="content-card__description">${escapeHtml(desc)}</p>` : ''}
      ${formattedDuration ? `<span class="content-card__duration">${formattedDuration}</span>` : ''}
    </div>
  </div>`;
}

export function wireContentCardErrorHandling(cardId: string): void {
  const img = document.getElementById(`${cardId}-img`) as HTMLImageElement;
  const poster = document.getElementById(`${cardId}-poster`);
  if (img && poster) {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      poster.classList.add('content-card__poster--error');
    });
  }
}
