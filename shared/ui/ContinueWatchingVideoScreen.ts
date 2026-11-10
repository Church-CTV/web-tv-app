/**
 * Shared ContinueWatchingVideoScreen — renders video playback with continue watching position restore.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the continue watching video screen as an HTML string.
 * Combines video playback UI with continue watching resume info.
 */
export function renderContinueWatchingVideoScreen(props: {
  videoId: string;
  title: string;
  streamUrl: string;
  duration?: number;
  position?: number;
  onBack?: () => void;
}): string {
  const { videoId, title, streamUrl, duration = 0, position = 0, onBack } = props;
  // A live stream's Infinity duration would make any position look resumable.
  const hasResume = position > 0 && Number.isFinite(duration) && position < duration;
  const resumePosition = position > 0 ? `${Math.floor(position / 60)}m` : '';

  let html = '<div class="video-screen" id="video-screen">';

  // Back button if onBack is provided
  if (onBack) {
    html +=
      '<div class="video-screen__back"><button class="video-screen__back-btn" id="btn-video-back" tabindex="0">← Back</button></div>';
  }

  // Video player
  html += '<div class="video-screen__player">';
  html += `<video id="video-${videoId}" class="video-screen__player-video" controls autoplay src="${streamUrl}"></video>`;
  html += '</div>';

  // Continue watching resume banner
  if (hasResume && resumePosition) {
    html += `<div class="video-screen__resume-banner">Resume from ${resumePosition}?<button class="video-screen__resume-confirm" id="btn-resume-confirm" data-position="${position}" tabindex="0">Resume</button><button class="video-screen__resume-start" id="btn-resume-start" tabindex="0">Start Over</button></div>`;
  }

  // Progress bar
  html += `<div class="video-screen__progress" id="progress-${videoId}">`;
  html += '<div class="video-screen__progress-bar" style="width:0%"></div>';
  html += '</div>';

  // Time display
  html += `<div class="video-screen__time" id="time-${videoId}">0:00 / 0:00</div>`;

  // Title info
  html += `<div class="video-screen__info"><h2 class="video-screen__title">${escapeHtml(title)}</h2></div>`;

  html += '</div>';
  return html;
}

/**
 * Initialize continue watching video screen interactivity.
 */
export function initContinueWatchingVideoScreen(videoId: string, _duration: number): void {
  const videoEl = document.getElementById(`video-${videoId}`) as HTMLVideoElement | null;
  const progressBar = document.getElementById(`progress-${videoId}`) as HTMLElement | null;
  const timeDisplay = document.getElementById(`time-${videoId}`) as HTMLElement | null;

  if (!videoEl || !progressBar || !timeDisplay) return;

  const updateProgress = (): void => {
    const pos = videoEl.currentTime;
    const dur = videoEl.duration;
    // Infinity (live) and NaN (unloaded) are not usable totals; see shared/ui/VideoScreen.ts.
    const known = Number.isFinite(dur) && dur > 0;
    if (known) {
      // Clamp: this screen exists to resume from a stored position, which is exactly
      // where a saved point can exceed the current duration (re-encode, trim, or a
      // stale entry). See shared/ui/VideoScreen.ts for the same contract.
      const percent = Math.max(0, Math.min(1, pos / dur)) * 100;
      const bar = progressBar.querySelector('.video-screen__progress-bar') as HTMLElement;
      if (bar) {
        bar.style.width = `${percent}%`;
      }
      timeDisplay.textContent = `${formatTime(pos)} / ${formatTime(dur)}`;
    } else if (Number.isFinite(pos)) {
      timeDisplay.textContent = `${formatTime(pos)} / --:--`;
    }
  };

  // Seek via progress bar click
  progressBar.addEventListener('click', (e: MouseEvent) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const dur = videoEl.duration;
    videoEl.currentTime = percent * dur;
  });

  // Resume confirm — jump to saved position
  const resumeBtn = document.getElementById('btn-resume-confirm') as HTMLButtonElement | null;
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      const posStr = resumeBtn.getAttribute('data-position');
      if (posStr) {
        videoEl.currentTime = parseFloat(posStr);
      }
    });
  }

  // Start over — reset to beginning
  const startOverBtn = document.getElementById('btn-resume-start') as HTMLButtonElement | null;
  if (startOverBtn) {
    startOverBtn.addEventListener('click', () => {
      videoEl.currentTime = 0;
    });
  }

  videoEl.addEventListener('timeupdate', updateProgress);
}

function formatTime(seconds: number): string {
  // See shared/ui/VideoScreen.ts: a live duration is Infinity and an unloaded
  // element's is NaN; neither is formattable, and `--:--` is the pinned unknown.
  if (!Number.isFinite(seconds)) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
