/**
 * Tizen VideoPlayer Adapter — HTML5 <video> element with Tizen-specific playback control.
 */

import { createScreenSaverControl } from './ScreenSaver';
import {
  clearResumePoint,
  loadResumePoint,
  saveResumePoint,
  type ResumePoint,
  type ResumeStore,
} from '@ctv/shared/ui/Resume';

export type PlaybackState = 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface VideoPlayer {
  play(url: string, quality?: string): void;
  /**
   * The resume point this playback started from, or null when it started from
   * the beginning. The video screen shows it so the viewer knows they are
   * somewhere other than zero and can go back if the seek was wrong.
   */
  getResumePoint(): ResumePoint | null;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(position: number): void;
  getState(): PlaybackState;
  getDuration(): number;
  getCurrentTime(): number;
  getPosition(): number;
  isPlaying(): boolean;
  onStateChange(cb: (state: PlaybackState) => void): void;
  /** Remove a callback added by `onStateChange` (see the webOS adapter). */
  offStateChange?(cb: (state: PlaybackState) => void): void;
  onError(cb: (error: string) => void): void;
  destroy(): void;
  // L2c-5: captions and audio-track APIs
  setCaptions(enabled: boolean): void;
  getCaptionsEnabled(): boolean;
  setAudioTrack(index: number): void;
  getAvailableAudioTracks(): Array<{ id: string; label: string; language: string }>;
  getCurrentAudioTrack(): number;
}

/** Delay (ms) a track change is suppressed for after a source/track change. */
const TRACK_CHANGE_SUPPRESS_MS = 500;
/** Sentinel for "no audio track selected". */
const NO_AUDIO_TRACK = -1;

/** Seconds between writes of the playback position. */
const RESUME_SAVE_INTERVAL_SECONDS = 5;

/**
 * Create a VideoPlayer instance backed by an HTML5 <video> element.
 * Uses Tizen's video player capabilities.
 *
 * @param options.storage - where the playback position is remembered. Omit it and
 *   playback simply starts from zero every time (the behaviour this adapter had
 *   before Samsung's MF-09 continue-watching requirement was measured).
 * @param options.videoId - which programme is loaded, read when playback starts,
 *   because the adapter is created once and plays many programmes.
 */
export interface VideoPlayerOptions {
  storage?: ResumeStore;
  videoId?: () => string | null;
  saveIntervalSeconds?: number;
}

export function createVideoPlayer(
  videoElement: HTMLVideoElement,
  options: VideoPlayerOptions = {}
): VideoPlayer {
  let currentState: PlaybackState = 'idle';
  let stopInProgress = false;
  let stopped = false; // L2c-4: ignore stale events after stop() until play() is called again
  let trackChangeInProgress = false; // L2c-5: suppress spurious state transitions during track changes
  let trackChangeTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAudioTrack = NO_AUDIO_TRACK; // L2c-5: current audio track index (-1 = none selected)
  const stateCallbacks: ((state: PlaybackState) => void)[] = [];
  const errorCallbacks: ((error: string) => void)[] = [];

  // Samsung MF-04/MF-05: the screensaver has to be off for the whole time a picture is
  // moving (including buffering, which is playback with a wait in it) and back on the
  // moment playback stops, pauses, ends or fails. This is the adapter's single state
  // choke point, so every state path - present and future - inherits the policy.
  const screenSaver = createScreenSaverControl(videoElement.ownerDocument?.defaultView ?? null);

  // MF-09: remember where the viewer stopped, and start the next session there.
  // Kept in the adapter, next to the state machine, because "stopped" and "ended"
  // are facts only the adapter can see; the screen would have to guess otherwise.
  const resumeStore = options.storage;
  const resumeEnabled = Boolean(resumeStore && options.videoId);
  const saveIntervalSeconds = options.saveIntervalSeconds ?? RESUME_SAVE_INTERVAL_SECONDS;
  let resumePoint: ResumePoint | null = null;
  let lastResumeSaveSeconds = -1;

  const loadedVideoId = (): string | null => {
    try {
      return options.videoId?.() ?? null;
    } catch {
      return null;
    }
  };

  const persistPosition = (): void => {
    if (!resumeEnabled || !resumeStore) return;
    const videoId = loadedVideoId();
    if (!videoId) return;
    const duration = videoElement.duration || 0;
    const position = videoElement.currentTime || 0;
    // A live stream has no finite duration, so there is nowhere to resume to.
    if (!Number.isFinite(duration) || duration <= 0) return;
    const secondsSinceSave = Math.floor(position) - lastResumeSaveSeconds;
    if (secondsSinceSave < saveIntervalSeconds && position < duration) return;
    if (saveResumePoint(resumeStore, videoId, position, duration)) {
      lastResumeSaveSeconds = Math.floor(position);
    }
  };

  const restorePosition = (): void => {
    resumePoint = null;
    if (!resumeEnabled || !resumeStore) return;
    const videoId = loadedVideoId();
    if (!videoId) return;
    const point = loadResumePoint(resumeStore, videoId);
    if (!point) return;
    try {
      videoElement.currentTime = point.position;
      resumePoint = point;
      lastResumeSaveSeconds = Math.floor(point.position);
    } catch {
      // Some firmwares reject a seek before the buffer is ready; starting from
      // zero is worse than a missed resume, never a broken player.
    }
  };

  const onLoadedMetadata = (): void => {
    restorePosition();
  };

  const onTimeUpdate = (): void => {
    if (currentState !== 'playing') return;
    persistPosition();
  };

  const notifyState = (state: PlaybackState): void => {
    screenSaver.keepAwake(state === 'playing' || state === 'buffering');
    stateCallbacks.forEach((cb) => cb(state));
  };

  // L2c-5: mark track change in progress to suppress spurious state transitions
  const beginTrackChange = (): void => {
    trackChangeInProgress = true;
    if (trackChangeTimer) {
      clearTimeout(trackChangeTimer);
      trackChangeTimer = null;
    }
    trackChangeTimer = setTimeout(() => {
      trackChangeInProgress = false;
      trackChangeTimer = null;
    }, TRACK_CHANGE_SUPPRESS_MS);
  };

  const onPlaying = () => {
    if (currentState !== 'playing') {
      currentState = 'playing';
      notifyState('playing');
    }
  };
  const onPause = () => {
    // The 'pause' event fires synchronously in real browsers when
    // stop() internally calls videoElement.pause(). The stopInProgress
    // flag prevents that event from overwriting the 'idle' state with
    // 'paused'. In jsdom the flag is harmless (events are not auto-fired).
    if (stopInProgress) return;
    // Deduplicate: only notify on actual transition from non-paused.
    if (currentState !== 'paused') {
      currentState = 'paused';
      notifyState('paused');
    }
  };
  const onWaiting = () => {
    // L2c-4: ignore stale buffering events after stop() until play() is called again
    if (stopped) return;
    // L2c-5: ignore spurious buffering during track changes
    if (trackChangeInProgress) return;
    if (currentState !== 'buffering') {
      currentState = 'buffering';
      notifyState('buffering');
    }
  };
  const onError = () => {
    if (currentState !== 'error') {
      currentState = 'error';
      notifyState('error');
    }
    const message = videoElement.error?.message ?? 'Unknown video error';
    errorCallbacks.forEach((cb) => cb(message));
  };
  const onEnded = () => {
    // Watched to the end: there is nothing to resume, and leaving the point
    // behind would replay the last minute of a programme they finished.
    const videoId = loadedVideoId();
    if (resumeEnabled && resumeStore && videoId) clearResumePoint(resumeStore, videoId);
    if (currentState !== 'ended') {
      currentState = 'ended';
      notifyState('ended');
    }
  };
  const onStalled = () => {
    // L2c-4: ignore stale stall events after stop() until play() is called again
    if (stopped) return;
    // L2c-5: ignore spurious stall during track changes
    if (trackChangeInProgress) return;
    if (currentState !== 'buffering') {
      currentState = 'buffering';
      notifyState('buffering');
    }
  };

  videoElement.addEventListener('playing', onPlaying);
  videoElement.addEventListener('pause', onPause);
  videoElement.addEventListener('waiting', onWaiting);
  videoElement.addEventListener('stalled', onStalled);
  videoElement.addEventListener('error', onError);
  videoElement.addEventListener('ended', onEnded);
  videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
  videoElement.addEventListener('timeupdate', onTimeUpdate);

  return {
    play(url: string, _quality?: string): void {
      stopped = false; // L2c-4: re-enable event processing
      resumePoint = null;
      lastResumeSaveSeconds = -1;
      videoElement.src = url;
      const p = videoElement.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          currentState = 'error';
          notifyState('error');
        });
      }
    },
    pause(): void {
      videoElement.pause();
    },
    resume(): void {
      // Set state synchronously so consumers see 'playing' immediately
      // without waiting for the async 'playing' event (which may not fire
      // if the media is already playing or jsdom is used).
      if (currentState === 'paused') {
        currentState = 'playing';
        notifyState('playing');
      }
      const p = videoElement.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          currentState = 'error';
          notifyState('error');
        });
      }
    },
    stop(): void {
      // Position first: clearing `src` below wipes currentTime.
      persistPosition();
      // Signal that the 'pause' event about to fire is from stop(),
      // not a user-initiated pause — so the handler skips the update.
      stopInProgress = true;
      if (currentState !== 'idle') {
        currentState = 'idle';
        notifyState('idle');
      }
      videoElement.pause();
      videoElement.src = '';
      stopInProgress = false;
      stopped = true; // L2c-4: ignore stale events until play() is called again
    },
    seek(position: number): void {
      // If recovering from error, transition to buffering to reflect user's recovery intent
      if (currentState === 'error') {
        currentState = 'buffering';
        notifyState('buffering');
      }
      videoElement.currentTime = position;
    },
    getState(): PlaybackState {
      return currentState;
    },
    getDuration(): number {
      return videoElement.duration || 0;
    },
    getCurrentTime(): number {
      return videoElement.currentTime || 0;
    },
    getPosition(): number {
      return videoElement.currentTime || 0;
    },
    getResumePoint(): ResumePoint | null {
      return resumePoint;
    },
    isPlaying(): boolean {
      return currentState === 'playing';
    },
    onStateChange(cb: (state: PlaybackState) => void): void {
      stateCallbacks.push(cb);
    },
    offStateChange(cb: (state: PlaybackState) => void): void {
      const i = stateCallbacks.indexOf(cb);
      if (i >= 0) stateCallbacks.splice(i, 1);
    },
    onError(cb: (error: string) => void): void {
      errorCallbacks.push(cb);
    },
    // L2c-5: captions and audio-track APIs
    setCaptions(enabled: boolean): void {
      beginTrackChange();
      const tracks = videoElement.textTracks;
      if (!tracks) return;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track) continue;
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          track.mode = enabled ? 'showing' : 'disabled';
        }
      }
    },
    getCaptionsEnabled(): boolean {
      const tracks = videoElement.textTracks;
      if (!tracks) return false;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (
          track &&
          (track.kind === 'subtitles' || track.kind === 'captions') &&
          track.mode === 'showing'
        ) {
          return true;
        }
      }
      return false;
    },
    setAudioTrack(index: number): void {
      beginTrackChange();
      currentAudioTrack = index;
      // Note: HTMLVideoElement has no standard audioTracks API.
      // The selected audio track index is tracked internally for state
      // consumers; the actual <video> element uses src attribute changes
      // or HLS track selection at the stream level when needed.
    },
    getAvailableAudioTracks(): Array<{ id: string; label: string; language: string }> {
      // Note: HTMLVideoElement has no standard audioTracks API.
      // Return empty array until a platform-specific audio-track list is provided.
      return [];
    },
    getCurrentAudioTrack(): number {
      return currentAudioTrack;
    },
    destroy(): void {
      videoElement.removeEventListener('playing', onPlaying);
      videoElement.removeEventListener('pause', onPause);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('stalled', onStalled);
      persistPosition();
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('ended', onEnded);
      if (trackChangeTimer) {
        clearTimeout(trackChangeTimer);
        trackChangeTimer = null;
      }
    },
  };
}
