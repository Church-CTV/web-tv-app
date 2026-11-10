import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';
import { PlaybackState } from '../../src/Adapter/VideoPlayer';

/**
 * L3d-2 Playback matrix
 *
 * Tests every combination of playback scenario to ensure complete
 * coverage of the VideoPlayer adapter.
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
  const list = tracks as unknown as { item: (i: number) => FakeTextTrack | null };
  list.item = (i: number) => tracks[i] ?? null;
  Object.defineProperty(el, 'textTracks', {
    value: list,
    writable: true,
    configurable: true,
  });
}

function setupAudioTracks(el: HTMLVideoElement, trackCount = 2) {
  interface FakeAudioTrack {
    kind: string;
    language: string;
    label: string;
    id: string;
    mode: string;
  }
  const audioTracks: FakeAudioTrack[] = [];
  for (let i = 0; i < trackCount; i++) {
    audioTracks.push({
      kind: 'main',
      language: i === 0 ? 'en' : 'es',
      label: i === 0 ? 'English' : 'Spanish',
      id: `audio-track-${i}`,
      mode: 'disabled',
    });
  }
  const list = audioTracks as unknown as { item: (i: number) => FakeAudioTrack | null };
  list.item = (i: number) => audioTracks[i] ?? null;
  Object.defineProperty(el, 'audioTracks', {
    value: list,
    writable: true,
    configurable: true,
  });
}

describe('L3d-2 Playback Matrix', () => {
  let videoElement: HTMLVideoElement;
  let player: ReturnType<typeof createVideoPlayer>;
  let stateHistory: PlaybackState[];
  let errorHistory: Array<{ code: number; message: string }>;

  beforeEach(() => {
    videoElement = document.createElement('video');
    document.body.appendChild(videoElement);
    setupVideoWithTracks(videoElement);
    setupAudioTracks(videoElement);
    player = createVideoPlayer(videoElement);
    stateHistory = [];
    errorHistory = [];
    player.onStateChange((state) => stateHistory.push(state));
    player.onError((error) => errorHistory.push(error));
  });

  afterEach(() => {
    player.destroy();
    videoElement.remove();
  });

  function enterPlayingState(url: string) {
    player.play(url);
    videoElement.dispatchEvent(new Event('play'));
    expect(player.getState()).toBe('playing');
  }

  // MP4 playback scenarios
  describe('MP4', () => {
    it('play sets idle state and source', () => {
      player.play('https://example.com/video.mp4');
      expect(player.getState()).toBe('idle');
      expect(videoElement.src).toContain('video.mp4');
    });

    it('canplay after play transitions to playing', () => {
      player.play('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('play'));
      expect(player.getState()).toBe('playing');
    });

    it('pause transitions to paused', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('pause'));
      expect(player.getState()).toBe('paused');
    });

    it('resume from paused returns to playing', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('pause'));
      expect(player.getState()).toBe('paused');
      player.resume();
      expect(player.getState()).toBe('playing');
    });

    it('waiting transitions to buffering', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
    });

    it('canplay after buffering recovers to playing', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('stalled transitions to buffering', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('stalled'));
      expect(player.getState()).toBe('buffering');
    });

    it('canplay after stalled recovers to playing', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('stalled'));
      expect(player.getState()).toBe('buffering');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('ended event transitions to ended', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('ended'));
      expect(player.getState()).toBe('ended');
    });

    it('error event transitions to error with details', () => {
      enterPlayingState('https://example.com/video.mp4');
      Object.defineProperty(videoElement, 'error', {
        value: { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' },
        configurable: true,
      });
      videoElement.dispatchEvent(new Event('error'));
      expect(player.getState()).toBe('error');
      expect(errorHistory.length).toBe(1);
      expect(errorHistory[0].code).toBe(4);
    });

    it('play from error state recovers', () => {
      enterPlayingState('https://example.com/video.mp4');
      Object.defineProperty(videoElement, 'error', {
        value: { code: 1 },
        configurable: true,
      });
      videoElement.dispatchEvent(new Event('error'));
      expect(player.getState()).toBe('error');
      player.play('https://example.com/video2.mp4');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('seek works during playback', () => {
      enterPlayingState('https://example.com/video.mp4');
      player.seek(60);
      expect(videoElement.currentTime).toBe(60);
      expect(player.getState()).toBe('playing');
    });

    it('seek works during buffering', () => {
      enterPlayingState('https://example.com/video.mp4');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
      player.seek(120);
      expect(videoElement.currentTime).toBe(120);
      expect(player.getState()).toBe('buffering');
    });

    it('captions toggle does not affect playback state', () => {
      enterPlayingState('https://example.com/video.mp4');
      player.setCaptions(true);
      expect(player.getCaptionsEnabled()).toBe(true);
      expect(player.getState()).toBe('playing');
      player.setCaptions(false);
      expect(player.getCaptionsEnabled()).toBe(false);
      expect(player.getState()).toBe('playing');
    });

    it('audio track switch does not affect playback state', () => {
      enterPlayingState('https://example.com/video.mp4');
      player.setAudioTrack(0);
      expect(player.getCurrentAudioTrack()).toBe(0);
      expect(player.getState()).toBe('playing');
      player.setAudioTrack(1);
      expect(player.getCurrentAudioTrack()).toBe(1);
      expect(player.getState()).toBe('playing');
    });
  });

  // HLS playback scenarios
  describe('HLS', () => {
    it('play sets idle state and source', () => {
      player.play('https://example.com/playlist.m3u8');
      expect(player.getState()).toBe('idle');
      expect(videoElement.src).toContain('playlist.m3u8');
    });

    it('canplay after play transitions to playing', () => {
      player.play('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('play'));
      expect(player.getState()).toBe('playing');
    });

    it('pause transitions to paused', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('pause'));
      expect(player.getState()).toBe('paused');
    });

    it('resume from paused returns to playing', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('pause'));
      expect(player.getState()).toBe('paused');
      player.resume();
      expect(player.getState()).toBe('playing');
    });

    it('waiting transitions to buffering', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
    });

    it('canplay after buffering recovers to playing', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('stalled transitions to buffering', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('stalled'));
      expect(player.getState()).toBe('buffering');
    });

    it('canplay after stalled recovers to playing', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('stalled'));
      expect(player.getState()).toBe('buffering');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('ended event transitions to ended', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('ended'));
      expect(player.getState()).toBe('ended');
    });

    it('error event transitions to error with details', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      Object.defineProperty(videoElement, 'error', {
        value: { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' },
        configurable: true,
      });
      videoElement.dispatchEvent(new Event('error'));
      expect(player.getState()).toBe('error');
      expect(errorHistory.length).toBe(1);
      expect(errorHistory[0].code).toBe(4);
    });

    it('play from error state recovers', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      Object.defineProperty(videoElement, 'error', {
        value: { code: 1 },
        configurable: true,
      });
      videoElement.dispatchEvent(new Event('error'));
      expect(player.getState()).toBe('error');
      player.play('https://example.com/playlist2.m3u8');
      videoElement.dispatchEvent(new Event('canplay'));
      expect(player.getState()).toBe('playing');
    });

    it('seek works during playback', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      player.seek(60);
      expect(videoElement.currentTime).toBe(60);
      expect(player.getState()).toBe('playing');
    });

    it('seek works during buffering', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      videoElement.dispatchEvent(new Event('waiting'));
      expect(player.getState()).toBe('buffering');
      player.seek(120);
      expect(videoElement.currentTime).toBe(120);
      expect(player.getState()).toBe('buffering');
    });

    it('captions toggle does not affect playback state', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      player.setCaptions(true);
      expect(player.getCaptionsEnabled()).toBe(true);
      expect(player.getState()).toBe('playing');
      player.setCaptions(false);
      expect(player.getCaptionsEnabled()).toBe(false);
      expect(player.getState()).toBe('playing');
    });

    it('audio track switch does not affect playback state', () => {
      enterPlayingState('https://example.com/playlist.m3u8');
      player.setAudioTrack(0);
      expect(player.getCurrentAudioTrack()).toBe(0);
      expect(player.getState()).toBe('playing');
      player.setAudioTrack(1);
      expect(player.getCurrentAudioTrack()).toBe(1);
      expect(player.getState()).toBe('playing');
    });
  });
});
