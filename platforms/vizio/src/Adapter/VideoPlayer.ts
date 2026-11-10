/**
 * Vizio VideoPlayer Adapter — HTML5 <video> element with Vizio-specific playback control.
 */

export type PlaybackState = 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface VideoPlayer {
  play(url: string, quality?: string): void;
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

export function createVideoPlayer(videoElement: HTMLVideoElement): VideoPlayer {
  let currentState: PlaybackState = 'idle';
  let stopInProgress = false;
  let stopped = false; // L2c-4: ignore stale events after stop() until play() is called again
  let trackChangeInProgress = false; // L2c-5: suppress spurious state transitions during track changes
  let trackChangeTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAudioTrack = -1; // L2c-5: current audio track index (-1 = none selected)
  const stateCallbacks: ((state: PlaybackState) => void)[] = [];
  const errorCallbacks: ((error: string) => void)[] = [];

  const notifyState = (state: PlaybackState): void => {
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
    }, 500);
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

  return {
    play(url: string, _quality?: string): void {
      stopped = false; // L2c-4: re-enable event processing
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
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('ended', onEnded);
      if (trackChangeTimer) {
        clearTimeout(trackChangeTimer);
        trackChangeTimer = null;
      }
    },
  };
}
