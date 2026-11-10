/**
 * Shared ContentDetail — renders the main content detail view.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ContentDetailProps {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  streamUrl: string;
  onPlay?: () => void;
  onWatchLater?: () => void;
}

export function renderContentDetail(props: ContentDetailProps): string {
  const { videoId, title, description, thumbnail, streamUrl, onPlay, onWatchLater } = props;

  return `<div class="content-detail" data-video-id="${escapeHtml(videoId)}">
    <div class="content-detail__poster" style="background-image:url('${escapeHtml(thumbnail)}')"></div>
    <div class="content-detail__info">
      <h1 class="content-detail__title">${escapeHtml(title)}</h1>
      ${description ? `<p class="content-detail__description">${escapeHtml(description)}</p>` : ''}
      <div class="content-detail__actions">
        ${onPlay ? `<button id="btn-play" class="button-primary" data-stream-url="${escapeHtml(streamUrl)}">▶ Play</button>` : ''}
        ${onWatchLater ? `<button id="btn-watch-later" class="button-secondary">+ Watch Later</button>` : ''}
      </div>
    </div>
  </div>`;
}

export function initContentDetail(container: HTMLDivElement, props: ContentDetailProps): void {
  const playBtn = container.querySelector('#btn-play');
  if (playBtn && props.onPlay) {
    playBtn.addEventListener('click', props.onPlay);
  }
  const wlBtn = container.querySelector('#btn-watch-later');
  if (wlBtn && props.onWatchLater) {
    wlBtn.addEventListener('click', props.onWatchLater);
  }
}
