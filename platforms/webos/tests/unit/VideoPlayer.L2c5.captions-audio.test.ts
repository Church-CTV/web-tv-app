import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';

/**
 * L2c-5 — Captions and audio-track change state recovery
 *
 * Bug: VideoPlayer adapters have no captions/audio-track API.
 * Toggling captions or switching audio tracks mid-playback can trigger
 * browser events (waiting/canplay) that corrupt the state machine.
 *
 * Fix: Add setCaptions(), getCaptionsEnabled(), setAudioTrack(),
 * getAvailableAudioTracks(), getCurrentAudioTrack() methods that
 * control tracks without corrupting playback state.
 */

interface FakeTextTrack {
  kind: string;
  language: string;
  label: string;
  mode: string;
  id: string;
}

function setupVideoWithTracks(el: HTMLVideoElement, trackCount = 2) {
  const tracks: FakeTextTrack[] = [];
  for (let i = 0; i < trackCount; i++) {
    tracks.push({
      kind: 'subtitles',
      language: i === 0 ? 'en' : 'es',
      label: i === 0 ? 'English' : 'Spanish',
      mode: 'disabled',
      id: `track-${i}`,
    });
  }
  // Create an indexable list supporting both tracks[i] and tracks.item(i).
  const list = tracks as unknown as {
    item: (i: number) => FakeTextTrack | null;
  };
  list.item = (i: number) => tracks[i] ?? null;
  Object.defineProperty(el, 'textTracks', {
    value: list,
    writable: true,
    configurable: true,
  });
}

describe('VideoPlayer - L2c-5: Captions and audio-track state recovery', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    document.body.appendChild(videoElement);
    setupVideoWithTracks(videoElement);
    player = createVideoPlayer(videoElement);
  });

  afterEach(() => {
    player.destroy();
    videoElement.remove();
  });

  // === Captions API ===

  it('RED: setCaptions(true) enables the caption track', () => {
    player.setCaptions(true);
    const tracks = videoElement.textTracks as unknown as {
      item: (i: number) => FakeTextTrack | null;
    };
    expect(tracks.item(0)!.mode).toBe('showing');
  });

  it('RED: setCaptions(false) disables the caption track', () => {
    player.setCaptions(true);
    player.setCaptions(false);
    const tracks = videoElement.textTracks as unknown as {
      item: (i: number) => FakeTextTrack | null;
    };
    expect(tracks.item(0)!.mode).toBe('disabled');
  });

  it('RED: getCaptionsEnabled() returns true when captions are showing', () => {
    player.setCaptions(true);
    expect(player.getCaptionsEnabled()).toBe(true);
  });

  it('RED: getCaptionsEnabled() returns false when captions are disabled', () => {
    expect(player.getCaptionsEnabled()).toBe(false);
  });

  // === State integrity: captions while playing ===

  it('RED: setCaptions(true) while playing does not change playback state', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.setCaptions(true);
    expect(player.getState()).toBe('playing');
  });

  it('RED: setCaptions(false) while playing does not change playback state', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.setCaptions(false);
    expect(player.getState()).toBe('playing');
  });

  it('RED: setCaptions(true) while paused does not change playback state', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    player.setCaptions(true);
    expect(player.getState()).toBe('paused');
  });

  it('RED: setCaptions() while in error state does not change error state', () => {
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    player.setCaptions(true);
    expect(player.getState()).toBe('error');
  });

  it('RED: setCaptions() while ended does not change ended state', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('ended'));
    expect(player.getState()).toBe('ended');

    player.setCaptions(true);
    expect(player.getState()).toBe('ended');
  });

  // === Audio track API ===

  it('RED: getAvailableAudioTracks() returns an array', () => {
    const tracks = player.getAvailableAudioTracks();
    expect(Array.isArray(tracks)).toBe(true);
  });

  it('RED: getCurrentAudioTrack() returns -1 when no track is selected', () => {
    expect(player.getCurrentAudioTrack()).toBe(-1);
  });

  it('RED: setAudioTrack(index) while playing does not change playback state', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.setAudioTrack(0);
    expect(player.getState()).toBe('playing');
  });

  it('RED: setAudioTrack(index) while paused does not change playback state', () => {
    videoElement.dispatchEvent(new Event('play'));
    videoElement.dispatchEvent(new Event('pause'));
    expect(player.getState()).toBe('paused');

    player.setAudioTrack(0);
    expect(player.getState()).toBe('paused');
  });

  it('RED: setAudioTrack() while in error state does not change error state', () => {
    videoElement.dispatchEvent(new Event('error'));
    expect(player.getState()).toBe('error');

    player.setAudioTrack(0);
    expect(player.getState()).toBe('error');
  });

  // === Mid-playback track changes don't corrupt state ===

  it('RED: multiple rapid captions toggles do not corrupt state', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.setCaptions(true);
    player.setCaptions(false);
    player.setCaptions(true);

    expect(player.getState()).toBe('playing');
  });

  it('RED: rapid audio track switches do not corrupt state', () => {
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');

    player.setAudioTrack(0);
    player.setAudioTrack(1);
    player.setAudioTrack(0);

    expect(player.getState()).toBe('playing');
  });
});
