/**
 * G1 — Captions track tests for webOS createVideoScreen.
 * Tests: a <track kind="subtitles"> is attached when captionsUrl is set;
 * no track when captionsUrl is absent.
 */
import { describe, it, expect } from 'vitest';
import { createVideoScreen } from '../../src/ui/VideoScreen';

describe('G1: Captions track on webOS createVideoScreen', () => {
  it('attaches <track kind="subtitles"> when captionsUrl is set', () => {
    const screen = createVideoScreen({
      videoId: 'vid-cap',
      title: 'Captioned Video',
      streamUrl: '/stream/vid-cap.mp4',
      captionsUrl: '/captions/vid-cap-en.vtt',
    });
    const video = screen.querySelector('video');
    expect(video).toBeTruthy();
    const track = video!.querySelector('track');
    expect(track).toBeTruthy();
    expect(track!.getAttribute('kind')).toBe('subtitles');
    expect(track!.getAttribute('src')).toBe('/captions/vid-cap-en.vtt');
  });

  it('does NOT render a track element when captionsUrl is absent', () => {
    const screen = createVideoScreen({
      videoId: 'vid-nocap',
      title: 'No Captions',
      streamUrl: '/stream/vid-nocap.mp4',
    });
    const video = screen.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.querySelector('track')).toBeNull();
  });

  it('does NOT render a track element when captionsUrl is empty string', () => {
    const screen = createVideoScreen({
      videoId: 'vid-empty',
      title: 'Empty Captions URL',
      streamUrl: '/stream/vid-empty.mp4',
      captionsUrl: '',
    });
    const video = screen.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.querySelector('track')).toBeNull();
  });
});
