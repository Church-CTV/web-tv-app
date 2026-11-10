/**
 * Shared VideoScreen — video playback screen with controls overlay.
 * Pure render/init: no @ctv/core imports, no platform SDKs.
 */

export interface VideoScreenProps {
  videoId: string;
  title?: string;
  streamUrl: string;
  /** URL to a WebVTT subtitle track. When set, a <track kind="subtitles"> is rendered. */
  captionsUrl?: string;
  duration?: number;
  position?: number;
  description?: string;
  externalPlayerUrl?: string;
  onBack?: () => void;
  onSeek?: (position: number) => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function formatTime(seconds: number): string {
  // A live stream reports `duration: Infinity` and an element whose metadata has not
  // loaded reports NaN. Both are numbers to JS, and formatting either one produced
  // `Infinity:NaN:NaN`, which the time row painted verbatim. `--:--` is the honest
  // unknown, and it is what the progress contract pins.
  if (!Number.isFinite(seconds)) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Render the video screen HTML.
 */
export function renderVideoScreen(props: VideoScreenProps): string {
  const titleHtml = props.title
    ? `<div class="video-screen__title">${escapeHtml(props.title)}</div>`
    : '';
  const duration = props.duration || 0;
  // Infinity (live stream) and NaN (metadata not loaded yet) are numbers to JS but
  // not durations this contract can use: they used to reach formatTime and print
  // `Infinity:NaN:NaN`, and they made the resume banner promise a position inside a
  // stream of unknown length.
  const knownDuration = Number.isFinite(duration) && duration > 0;
  const durStr = knownDuration
    ? formatTime(duration)
    : Number.isFinite(duration)
      ? '0:00'
      : '--:--';

  // A stored resume point is data, not a guarantee, so clamp it into the media
  // before it becomes a width: a point that drifted past the end used to render
  // `width:250%` on both the banner and the main bar before the first timeupdate.
  const rawPosition = Number.isFinite(props.position ?? 0) ? Math.max(0, props.position ?? 0) : 0;
  const clampedPosition = knownDuration ? Math.min(rawPosition, duration) : rawPosition;

  // Resume banner if position > 0 and the duration is known
  let resumeHtml = '';
  if (clampedPosition > 0 && knownDuration) {
    const resumePercent = Math.min(100, Math.round((clampedPosition / duration) * 100));
    const resumeTime = formatTime(clampedPosition);
    resumeHtml = `<div class="video-screen__resume">
        <span class="video-screen__resume-text">Resuming from ${resumeTime}</span>
        <div class="video-screen__resume-progress">
          <div class="video-screen__resume-progress-bar" style="width:${resumePercent}%"></div>
        </div>
      </div>`;
  }

  // Captions track (WebVTT) — rendered when captionsUrl is provided
  const trackHtml = props.captionsUrl
    ? `<track kind="subtitles" src="${escapeAttr(props.captionsUrl)}" srclang="en" label="English"></track>`
    : '';

  // External player URL
  let playerHtml = `<video id="video-${escapeAttr(props.videoId)}" class="video-screen__player-video"
        controls autoplay src="${escapeAttr(props.streamUrl)}">${trackHtml}</video>`;
  if (props.externalPlayerUrl) {
    playerHtml = `<a class="video-screen__external-player" href="${escapeAttr(props.externalPlayerUrl)}" id="btn-external-player">Open in External Player</a>`;
  }

  // Progress bar at custom position
  const progressPercent =
    clampedPosition > 0 && knownDuration
      ? Math.min(100, Math.round((clampedPosition / duration) * 100))
      : 0;
  const currentTime = clampedPosition > 0 ? formatTime(clampedPosition) : '0:00';

  let html = `<div class="video-screen" id="video-screen">`;

  // Back button if onBack is provided
  if (props.onBack) {
    html +=
      '<div class="video-screen__back"><button class="video-screen__back-btn" id="btn-video-back" tabindex="0">&#8592; Back</button></div>';
  }

  html += `
    ${titleHtml}
    ${resumeHtml}
    <div class="video-screen__player">
      ${playerHtml}
    </div>
    <div class="video-screen__controls">
      <div class="video-screen__progress" id="progress-${escapeAttr(props.videoId)}">
        <div class="video-screen__progress-bar" style="width:${progressPercent}%"></div>
      </div>
      <div class="video-screen__time" id="time-${escapeAttr(props.videoId)}">${currentTime} / ${escapeAttr(durStr)}</div>
    </div>
  </div>`;
  return html;
}

/**
 * Initialize video screen interactivity (progress bar, seek).
 */
export function initVideoScreen(videoId: string, _duration: number): void {
  const videoEl = document.getElementById(`video-${videoId}`) as HTMLVideoElement | null;
  const progressBar = document.getElementById(`progress-${videoId}`) as HTMLElement | null;
  const timeDisplay = document.getElementById(`time-${videoId}`) as HTMLElement | null;
  if (!videoEl || !progressBar || !timeDisplay) return;

  const updateProgress = (): void => {
    const pos = videoEl.currentTime;
    const dur = videoEl.duration;
    // `dur > 0` alone lets a live stream's Infinity through, and formatTime(Infinity)
    // printed `Infinity:NaN:NaN` in the time row. The fill can only be a percentage
    // of a known length, so it stays empty while the elapsed clock keeps running.
    const known = Number.isFinite(dur) && dur > 0;
    if (known) {
      const bar = progressBar.querySelector('.video-screen__progress-bar') as HTMLElement;
      // Clamp before writing: a resume point that has drifted past the end of the
      // media produced e.g. width:250% and overflowed the track, and a negative
      // position produced a declaration the webview drops instead of emptying the
      // bar. Tizen and Vizio re-export this screen, so this one clamp covers all
      // three platforms. Pinned by shared/ui/VideoScreen.progress.test.ts.
      if (bar) bar.style.width = `${Math.max(0, Math.min(1, pos / dur)) * 100}%`;
      timeDisplay.textContent = `${formatTime(pos)} / ${formatTime(dur)}`;
    } else if (Number.isFinite(pos)) {
      timeDisplay.textContent = `${formatTime(pos)} / --:--`;
    }
  };

  progressBar.addEventListener('click', (e: MouseEvent) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = percent * videoEl.duration;
  });

  videoEl.addEventListener('timeupdate', updateProgress);
}
