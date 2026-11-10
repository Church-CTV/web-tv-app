/**
 * WebOS VideoPlayer Adapter — HTML5 <video> element + webOSTV.js playback control.
 */

export type PlaybackState = 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface VideoPlayer {
  play(url: string, quality?: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(position: number): void;
  getPosition(): number;
  getDuration(): number;
  isPlaying(): boolean;
  getState(): PlaybackState;
  onStateChange(callback: PlaybackStateCallback): void;
  /**
   * Remove a callback added by `onStateChange`. Optional because the app's
   * screen code must also accept a player implementation that never subscribes.
   */
  offStateChange?(callback: PlaybackStateCallback): void;
  onError(callback: ErrorCallback): void;
  destroy(): void;
  // L2c-5: captions and audio-track APIs
  setCaptions(enabled: boolean): void;
  getCaptionsEnabled(): boolean;
  setAudioTrack(index: number): void;
  getAvailableAudioTracks(): Array<{ id: string; label: string; language: string }>;
  getCurrentAudioTrack(): number;
  // J5: attach the player to a specific <video> element (the visible
  // element on the video screen). Optional so external player implementations
  // without element swapping can be used in tests.
  attachTo?(element: HTMLVideoElement): void;
  detach?(): void;
}

interface PlaybackStateCallback {
  (state: PlaybackState): void;
}

interface PlaybackError {
  code: number;
  message: string;
}

interface ErrorCallback {
  (error: PlaybackError): void;
}

/**
 * Create a video player from an HTML5 <video> element.
 * Integrates with core analytics for playback tracking.
 */
export function createVideoPlayer(videoElement: HTMLVideoElement): VideoPlayer {
  let currentState: PlaybackState = 'idle';
  let stopInProgress = false;
  let stopped = false; // L2c-4: ignore stale events after stop() until play() is called again
  let trackChangeInProgress = false; // L2c-5: suppress spurious state transitions during track changes
  let trackChangeTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAudioTrack = -1; // L2c-5: current audio track index (-1 = none selected)
  const stateCallbacks: PlaybackStateCallback[] = [];
  const errorCallbacks: ErrorCallback[] = [];
  // J5: the element the player is currently bound to. The same player can be
  // rebound to the visible <video> element on the video screen so state,
  // seek and playback control always apply to the element the user sees
  // (the duplicate-hidden-<video> bug made the progress bar and the visible
  // stream diverge, and the visible element could never seek).
  let el = videoElement;

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
    }, 500);
  };

  // Track playback state changes — capture handler refs for cleanup
  const onPlay = () => {
    if (currentState !== 'playing') {
      currentState = 'playing';
      notifyState('playing');
    }
  };
  const onPause = () => {
    // The 'pause' event fires synchronously in real browsers when
    // stop() internally calls el.pause(). The stopInProgress
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
  const onCanplay = () => {
    // L2c-4: ignore stale canplay events after stop() until play() is called again
    // This prevents the player from transitioning back to 'playing' when it should
    // remain 'idle' after being stopped.
    if (stopped) return;
    // L2c-5: ignore spurious canplay during track changes
    if (trackChangeInProgress) return;
    if (currentState === 'buffering' || currentState === 'error' || currentState === 'ended') {
      currentState = 'playing';
      notifyState('playing');
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
  const onEnded = () => {
    if (currentState !== 'ended') {
      currentState = 'ended';
      notifyState('ended');
    }
  };
  const onError = () => {
    const error: PlaybackError = {
      code: el.error?.code ?? -1,
      message: el.error?.message ?? 'Unknown video error',
    };
    if (currentState !== 'error') {
      currentState = 'error';
      notifyState('error');
    }
    errorCallbacks.forEach((cb) => cb(error));
  };

  el.addEventListener('play', onPlay);
  el.addEventListener('pause', onPause);
  el.addEventListener('waiting', onWaiting);
  el.addEventListener('canplay', onCanplay);
  el.addEventListener('stalled', onStalled);
  el.addEventListener('ended', onEnded);
  el.addEventListener('error', onError);

  function notifyState(state: PlaybackState): void {
    stateCallbacks.forEach((cb) => cb(state));
  }

  return {
    play(url: string, _quality?: string): void {
      stopped = false; // L2c-4: re-enable event processing
      // Only re-point the element when the source actually changes. When the
      // visible element already holds this exact source (VideoScreen set it),
      // resetting src would reload and restart the stream for no reason.
      if (el.src !== url && el.src !== window.location.origin + url) {
        el.src = url;
        el.load();
      }
      const playPromise = el.play();
      if (playPromise) {
        playPromise.catch(() => {
          currentState = 'error';
          notifyState('error');
        });
      }
    },
    pause(): void {
      el.pause();
    },
    resume(): void {
      // Set state synchronously so consumers see 'playing' immediately
      // without waiting for the async 'play' event (which may not fire
      // if the media is already playing or jsdom is used).
      if (currentState === 'paused') {
        currentState = 'playing';
        notifyState('playing');
      }
      const playPromise = el.play();
      if (playPromise) {
        playPromise.catch(() => {
          currentState = 'error';
          notifyState('error');
        });
      }
    },
    stop(): void {
      // Signal that the 'pause' event about to fire is from stop(),
      // not a user-initiated pause — so the handler skips the update.
      stopInProgress = true;
      if (currentState !== 'idle') {
        currentState = 'idle';
        notifyState('idle');
      }
      el.pause();
      el.removeAttribute('src');
      el.load();
      stopInProgress = false;
      stopped = true; // L2c-4: ignore stale events until play() is called again
    },
    seek(position: number): void {
      // If recovering from error, transition to buffering to reflect user's recovery intent
      if (currentState === 'error') {
        currentState = 'buffering';
        notifyState('buffering');
      }
      el.currentTime = position;
    },
    getPosition(): number {
      return el.currentTime;
    },
    getDuration(): number {
      return el.duration || 0;
    },
    isPlaying(): boolean {
      return currentState === 'playing';
    },
    getState(): PlaybackState {
      return currentState;
    },
    onStateChange(callback: PlaybackStateCallback): void {
      stateCallbacks.push(callback);
    },
    offStateChange(callback: PlaybackStateCallback): void {
      const i = stateCallbacks.indexOf(callback);
      if (i >= 0) stateCallbacks.splice(i, 1);
    },
    onError(callback: ErrorCallback): void {
      errorCallbacks.push(callback);
    },
    // L2c-5: captions and audio-track APIs
    setCaptions(enabled: boolean): void {
      beginTrackChange();
      const tracks = el.textTracks;
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
      const tracks = el.textTracks;
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
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanplay);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      if (trackChangeTimer) {
        clearTimeout(trackChangeTimer);
        trackChangeTimer = null;
      }
    },
    attachTo(element: HTMLVideoElement): void {
      // J5: rebind this player to the visible <video> element on the video
      // screen. Unbind from the previous element first so handlers, state
      // and control apply to exactly one element at a time.
      if (element === el) return;
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanplay);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el = element;
      el.addEventListener('play', onPlay);
      el.addEventListener('pause', onPause);
      el.addEventListener('waiting', onWaiting);
      el.addEventListener('canplay', onCanplay);
      el.addEventListener('stalled', onStalled);
      el.addEventListener('ended', onEnded);
      el.addEventListener('error', onError);
    },
    detach(): void {
      // Unbind all handlers from the current element (without destroying the
      // player). Used when a screen that was handed the shared player goes
      // away: the player object itself must keep living for the app, but it
      // must stop receiving events from the element it was attached to.
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanplay);
      el.removeEventListener('stalled', onStalled);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    },
  };
}
