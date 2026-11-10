/**
 * VideoScreen — Video playback screen with controls overlay.
 * Mirrors Roku's VideoScreen component with enhancements:
 *   - Trick play thumbnail strip for content >15min
 *   - Enhanced seek bar with time display
 *   - Video error states (network, playback, unsupported)
 *   - Focus ring animation on controls
 */

import { createVideoPlayer, type PlaybackState, type VideoPlayer } from '../Adapter/VideoPlayer';
import { savePosition, ContinueWatchingStore } from '@ctv/core/continue-watching/ContinueWatching';
import { renderVideoErrorDialog } from '@ctv/shared-ui/VideoErrorRenderer';
import { getPlatformI18n } from '../utils/PlatformI18n';

export interface VideoScreenProps {
  videoId: string;
  title: string;
  streamUrl: string;
  /** URL to a WebVTT subtitle track. When set, a <track kind="subtitles"> is rendered. */
  captionsUrl?: string;
  /** Thumbnail URLs for trick play strip (5s intervals). Populated by feed for content >15min. */
  thumbnails?: string[];
  duration?: number;
  onBack?: () => void;
  onSeek?: (position: number) => void;
  storage?: ContinueWatchingStore;
  /** External video player instance — if provided, VideoScreen uses it instead of creating one internally. */
  player?: VideoPlayer;
  /**
   * J5: id of the <video> element this screen should render into. When set,
   * the screen reuses that element instead of creating a new one, so there is
   * exactly one live <video> per screen (the duplicate element bug: two
   * elements buffering the same stream, the hidden one driving the player
   * state, and the visible one frozen because nothing ever controlled it).
   */
  videoElId?: string;
}

export interface VideoErrorState {
  code: 'network' | 'playback' | 'unsupported' | 'unknown';
  message: string;
}

/**
 * Create a VideoScreen component.
 * Renders a video player with enhanced controls overlay (play/pause, seek, progress).
 * Shows trick play thumbnail strip for content >15min during seek.
 * Shows error dialog on playback failures.
 */
export function createVideoScreen(props: VideoScreenProps): HTMLDivElement {
  const screen = document.createElement('div');
  screen.className = 'video-screen';

  // Error container (hidden by default — display:none so it doesn't
  // intercept pointer events until an error is actually shown).
  const errorContainer = document.createElement('div');
  errorContainer.className = 'video-error';
  errorContainer.style.display = 'none';
  errorContainer.style.position = 'absolute';
  errorContainer.style.top = '0';
  errorContainer.style.left = '0';
  errorContainer.style.width = '100%';
  errorContainer.style.height = '100%';
  errorContainer.style.zIndex = '10';
  errorContainer.style.alignItems = 'center';
  errorContainer.style.justifyContent = 'center';
  screen.appendChild(errorContainer);

  // Buffering indicator. The adapter already reports `buffering` when the stream
  // stalls (`waiting`) and returns to `playing` on `canplay`, but until this
  // screen subscribed to it a stall looked like a frozen frame with no
  // acknowledgement at all. Hidden by default; the state callback shows it.
  const bufferingEl = document.createElement('div');
  bufferingEl.className = 'video-buffering';
  bufferingEl.setAttribute('role', 'status');
  bufferingEl.setAttribute('aria-live', 'polite');
  bufferingEl.style.display = 'none';
  bufferingEl.textContent = getPlatformI18n().t('video.buffering');
  screen.appendChild(bufferingEl);

  // Video container
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-screen__player';

  // J5: exactly ONE live <video> per screen, and it must live INSIDE the
  // overlay so it is inside the active screen (the overlay is appended into
  // #screen-video by the caller). When the app passes videoElId (the
  // persistent #video-player), we RE-PARENT that same element into the
  // overlay instead of creating a second one. Creating a second <video> was
  // the double-buffer bug: two tags on the same stream, the hidden one driving
  // player state, the visible one frozen. Re-parenting keeps one element,
  // in the DOM position that actually gets shown and focused.
  let videoEl: HTMLVideoElement;
  const existingVideo = props.videoElId
    ? (document.getElementById(props.videoElId) as HTMLVideoElement | null)
    : null;
  if (existingVideo) {
    videoEl = existingVideo;
  } else {
    videoEl = document.createElement('video');
    videoEl.id = `video-${props.videoId}`;
  }
  videoEl.className = 'video-screen__player-video';
  // Make the visible video focusable so a focused element ALWAYS exists on
  // this screen (the player, controls, and back button all live here).
  videoEl.setAttribute('tabindex', '0');
  // No native `controls`: the CTV UI drives playback via the custom overlay
  // (progress bar + seek keys). Native controls would render a second
  // progress bar underneath ours (the "double progress bar" defect) and the
  // native focus ring would fight the custom one.
  videoEl.removeAttribute('controls');
  videoEl.setAttribute('autoplay', '');
  if (existingVideo) {
    // Re-parented: it already holds the current source; keep playback going
    // seamlessly instead of reloading.
  } else {
    videoEl.src = props.streamUrl;
  }
  // G1: captions track (WebVTT) — rendered when captionsUrl is provided
  if (props.captionsUrl) {
    // Avoid duplicating a track if the reparented element already has one.
    if (!videoEl.querySelector('track')) {
      const trackEl = document.createElement('track');
      trackEl.setAttribute('kind', 'subtitles');
      trackEl.setAttribute('src', props.captionsUrl);
      trackEl.setAttribute('srclang', 'en');
      trackEl.setAttribute('label', 'English');
      videoEl.appendChild(trackEl);
    }
  }
  videoContainer.appendChild(videoEl);

  screen.appendChild(videoContainer);

  // Trick play thumbnail strip (for content >15min)
  const trickplayStrip = document.createElement('div');
  trickplayStrip.className = 'trickplay-strip';
  trickplayStrip.style.display = 'none';
  screen.appendChild(trickplayStrip);

  // Populate thumbnails if provided and duration > 15min
  const THRESHOLD_MINUTES = 15;
  const hasThumbnails =
    props.duration &&
    Number.isFinite(props.duration) &&
    props.duration > THRESHOLD_MINUTES * 60 &&
    props.thumbnails &&
    props.thumbnails.length > 0;

  if (hasThumbnails) {
    for (const thumb of props.thumbnails!) {
      const img = document.createElement('img');
      img.className = 'trickplay-strip__thumb';
      img.src = thumb;
      img.alt = '';
      img.tabIndex = 0;
      trickplayStrip.appendChild(img);
    }
  }

  // Controls overlay
  const controls = document.createElement('div');
  controls.className = 'video-screen__controls';

  // Progress bar with seek thumb
  const progressBar = document.createElement('div');
  progressBar.className = 'video-screen__progress';
  progressBar.setAttribute('role', 'slider');
  progressBar.setAttribute('aria-valuemin', '0');
  // An unbounded duration (Infinity for a live stream, NaN before metadata) is not a
  // maximum: stringifying it wrote aria-valuemax="Infinity" onto a role="slider".
  // Omit the maximum instead so assistive tech reports an indeterminate control.
  if (Number.isFinite(props.duration ?? 0) && (props.duration ?? 0) > 0) {
    progressBar.setAttribute('aria-valuemax', String(props.duration));
  }
  progressBar.setAttribute('aria-valuenow', '0');
  progressBar.setAttribute('tabindex', '0');
  progressBar.setAttribute('aria-label', getPlatformI18n().t('video.progress_bar'));
  const progressFill = document.createElement('div');
  progressFill.className = 'video-screen__progress-bar';
  progressFill.setAttribute('aria-hidden', 'true');
  progressBar.appendChild(progressFill);
  controls.appendChild(progressBar);

  // Time display (elapsed / total)
  const timeDisplay = document.createElement('div');
  timeDisplay.className = 'video-screen__time';
  timeDisplay.textContent = `0:${'00'} / ${props.duration ? formatTime(props.duration) : '0:00'}`;
  controls.appendChild(timeDisplay);

  screen.appendChild(controls);

  // Initialize video player. The app passes in its shared player (created
  // against #video-player); when no player is provided we create one bound to
  // this screen's video element.
  const player = props.player ?? createVideoPlayer(videoEl);
  // J5: bind the player to the element actually visible on this screen.
  // The app's shared player was created against #video-player; if the screen
  // shows a different element, state and seek must track this one.
  player.attachTo?.(videoEl);

  // The app's player is created once and outlives every screen, so the
  // subscription must be removable: a bare `onStateChange` here would leave one
  // closure per video opened, toggling a detached node forever.
  const onPlayerState = (state: PlaybackState): void => {
    bufferingEl.style.display = state === 'buffering' ? 'flex' : 'none';
  };
  player.onStateChange?.(onPlayerState);

  // Track position for Continue Watching
  const POSITION_SAVE_INTERVAL = 30000;
  let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const saveCurrentPosition = (isEnded: boolean = false) => {
    const position = player.getPosition();
    const duration = player.getDuration();
    if (isEnded || position > 10) {
      if (props.storage) {
        savePosition(props.storage, props.videoId, props.title, position, duration || 0);
      }
    }
  };

  const onPlay = () => {
    positionSaveTimer = setInterval(() => saveCurrentPosition(), POSITION_SAVE_INTERVAL);
  };

  const onPause = () => {
    if (positionSaveTimer) {
      clearInterval(positionSaveTimer);
      positionSaveTimer = null;
    }
    saveCurrentPosition();
  };

  const onEnded = () => {
    if (positionSaveTimer) {
      clearInterval(positionSaveTimer);
      positionSaveTimer = null;
    }
    saveCurrentPosition(true);
  };

  videoEl.addEventListener('play', onPlay);
  videoEl.addEventListener('pause', onPause);
  videoEl.addEventListener('ended', onEnded);

  // Update progress and time
  const updateProgress = () => {
    const position = player.getPosition();
    const duration = player.getDuration();
    // `duration > 0` lets a live stream's Infinity through, which turned the derived
    // `Math.round(ratio * duration)` into NaN in aria-valuenow and Infinity:NaN:NaN in
    // the time row. Only a positive finite number is a usable total.
    const known = Number.isFinite(duration) && duration > 0;
    if (known) {
      // Clamp once, then derive both surfaces from the same clamped ratio. A stored
      // resume point past the end of the media used to write e.g. width:250% (the bar
      // overflowed its track) and a negative position wrote an invalid CSS value the
      // browser dropped, leaving the fill stuck at its previous width. The seek
      // handler below already clamps, so this is the same contract applied twice.
      const ratio = Math.max(0, Math.min(1, position / duration));
      progressFill.style.width = `${ratio * 100}%`;
      // aria-valuemax is authored in seconds from the duration, so aria-valuenow must
      // be seconds too: writing the percent here made a screen reader announce
      // "25 of 120" for a video that is 25% through 50 seconds.
      progressBar.setAttribute('aria-valuenow', String(Math.round(ratio * duration)));
      timeDisplay.textContent = `${formatTime(position)} / ${formatTime(duration)}`;
    } else if (Number.isFinite(position)) {
      // Elapsed time is still true information when the total is unknown, so the clock
      // keeps running and the announcement stays useful without inventing a total.
      timeDisplay.textContent = `${formatTime(position)} / --:--`;
      progressBar.setAttribute('aria-valuetext', formatTime(position));
    }
  };

  videoEl.addEventListener('timeupdate', updateProgress);

  // Seek on progress bar click AND keyboard
  const onSeek = (clientX: number) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = player.getDuration();
    if (!Number.isFinite(duration) || duration <= 0 || rect.width <= 0) return;
    const seekPosition = percent * duration;
    player.seek(seekPosition);
    if (props.onSeek) props.onSeek(seekPosition);

    // Show trick play strip during seek
    if (hasThumbnails) {
      trickplayStrip.style.display = 'flex';
      const thumbs = trickplayStrip.querySelectorAll('.trickplay-strip__thumb');
      const thumbIdx = Math.floor(percent * thumbs.length);
      thumbs.forEach((t, i) => {
        (t as HTMLElement).classList.toggle('active', i === thumbIdx);
      });
      // Scroll active thumb into view
      const active = thumbs[thumbIdx] as HTMLElement | undefined;
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  const onSeekClick = (e: MouseEvent) => onSeek(e.clientX);
  const onSeekKey = (e: KeyboardEvent) => {
    const duration = player.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    let seekAmount = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') seekAmount = duration * 0.05;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') seekAmount = -duration * 0.05;
    else return;
    e.preventDefault();
    const newPos = Math.max(0, Math.min(duration, player.getPosition() + seekAmount));
    player.seek(newPos);
    if (props.onSeek) props.onSeek(newPos);
  };

  progressBar.addEventListener('click', onSeekClick);
  progressBar.addEventListener('keydown', onSeekKey);

  // Hide trickplay strip on mouse up (end of seek)
  const onSeekEnd = () => {
    trickplayStrip.style.display = 'none';
  };
  document.addEventListener('mouseup', onSeekEnd, { once: true });

  // Store reference for cleanup
  let _onSeekEnd: (() => void) | null = onSeekEnd;

  // Video error handling
  const onVideoError = () => {
    // Save position on error
    saveCurrentPosition(false);
    showVideoError(getVideoError(videoEl));
  };
  videoEl.addEventListener('error', onVideoError);

  let disposed = false;
  let activeDialog: ReturnType<typeof renderVideoErrorDialog> | null = null;

  // Keep the error actionable until the retry has actually been accepted.
  function showVideoError(error: VideoErrorState) {
    if (disposed || activeDialog) return;
    videoEl.pause();
    const i18n = getPlatformI18n();
    const dialogLabels: Record<string, string> = {
      'error.video.title': i18n.t('error.video.title'),
      try_again: i18n.t('try_again'),
    };
    const dialog = renderVideoErrorDialog(
      error,
      (key) => dialogLabels[key] ?? key,
      async () => {
        if (disposed) return;
        if (videoEl.error) videoEl.load();
        await videoEl.play();
        if (disposed || activeDialog !== dialog) return;
        errorContainer.style.display = 'none';
        activeDialog = null;
      }
    );
    activeDialog = dialog;
    errorContainer.textContent = '';
    errorContainer.appendChild(dialog);
    errorContainer.style.display = 'flex';
    dialog.activate();
  }
  if (videoEl.error) showVideoError(getVideoError(videoEl));

  function getVideoError(el: HTMLVideoElement): VideoErrorState {
    const i18n = getPlatformI18n();
    const err = el.error;
    if (!err) return { code: 'unknown', message: i18n.t('video_error.unexpected') };

    switch (err.code) {
      case 1:
        return { code: 'unknown', message: i18n.t('video_error.aborted') };
      case 2:
        return { code: 'network', message: i18n.t('video_error.network') };
      case 3:
        return { code: 'playback', message: i18n.t('video_error.playback') };
      case 4:
        return { code: 'unsupported', message: i18n.t('video_error.unsupported') };
      default:
        return { code: 'unknown', message: i18n.t('video_error.unexpected') };
    }
  }

  // Back button
  if (props.onBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'video-screen__back';
    backBtn.setAttribute('data-action', 'back');
    backBtn.setAttribute('tabindex', '0');
    backBtn.textContent = getPlatformI18n().t('back');
    backBtn.addEventListener('click', () => {
      saveCurrentPosition(false);
      props.onBack!();
    });
    screen.appendChild(backBtn);
  }

  // Cleanup
  const cleanup = () => {
    disposed = true;
    activeDialog?.cleanup();
    activeDialog?.remove();
    activeDialog = null;
    errorContainer.style.display = 'none';
    if (positionSaveTimer) {
      clearInterval(positionSaveTimer);
      positionSaveTimer = null;
    }
    videoEl.removeEventListener('play', onPlay);
    videoEl.removeEventListener('pause', onPause);
    videoEl.removeEventListener('ended', onEnded);
    videoEl.removeEventListener('timeupdate', updateProgress);
    videoEl.removeEventListener('error', onVideoError);
    player.offStateChange?.(onPlayerState);
    progressBar.removeEventListener('click', onSeekClick);
    progressBar.removeEventListener('keydown', onSeekKey);
    if (_onSeekEnd) {
      document.removeEventListener('mouseup', _onSeekEnd);
      _onSeekEnd = null;
    }
    // When an external (shared app) player was passed in, only unbind it from
    // this element instead of destroying it. Destroying it would tear down the
    // single player the whole app relies on. When this screen created its own
    // player, destroy it fully to release its event listeners.
    if (props.player) {
      props.player.detach?.();
    } else {
      player.destroy();
    }
  };

  return Object.assign(screen, { cleanup }) as HTMLDivElement & { cleanup: () => void };
}

function formatTime(seconds: number): string {
  // A live stream reports `duration: Infinity` and an element whose metadata has not
  // loaded reports NaN. Either one reached here and produced `Infinity:NaN:NaN`,
  // which the time row painted verbatim. `--:--` is the honest unknown.
  if (!Number.isFinite(seconds)) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function updateVideoScreen(screen: HTMLDivElement, props: VideoScreenProps): void {
  const videoEl = screen.querySelector('video') as HTMLVideoElement;
  if (videoEl) {
    videoEl.src = props.streamUrl;
    videoEl.load();
  }
}

export function focusVideoPlayer(screen: HTMLDivElement): void {
  const retry = screen.querySelector('.error-dialog [data-action="retry"]') as HTMLElement | null;
  if (retry) {
    retry.focus();
    return;
  }
  const videoEl = screen.querySelector('video') as HTMLElement;
  if (videoEl) videoEl.focus();
}
