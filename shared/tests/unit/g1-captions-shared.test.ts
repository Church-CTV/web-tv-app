/**
 * G1 — Captions / subtitle track tests (shared VideoScreen).
 * Tests: a <track kind="subtitles"> is attached when captionsUrl is set;
 * no track when captionsUrl is absent.
 * Uses the shared renderVideoScreen() used by Tizen and Vizio.
 */
import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '../../ui/VideoScreen';

describe('G1: Captions track on shared VideoScreen', () => {
  it('attaches <track kind="subtitles"> when captionsUrl is set', () => {
    const html = renderVideoScreen({
      videoId: 'vid-1',
      title: 'Test',
      streamUrl: 'https://example.com/stream.mp4',
      captionsUrl: 'https://example.com/captions/en.vtt',
    });
    expect(html).toContain('<track');
    expect(html).toContain('kind="subtitles"');
    expect(html).toContain('src="https://example.com/captions/en.vtt"');
  });

  it('escapes captionsUrl in the track src attribute', () => {
    const html = renderVideoScreen({
      videoId: 'vid-1',
      streamUrl: 'https://example.com/s.mp4',
      captionsUrl: 'https://example.com/a"b.vtt',
    });
    // escapeAttr turns " into &quot;
    expect(html).toContain('src="https://example.com/a&quot;b.vtt"');
  });

  it('does NOT render a track element when captionsUrl is absent', () => {
    const html = renderVideoScreen({
      videoId: 'vid-1',
      streamUrl: 'https://example.com/s.mp4',
    });
    expect(html).not.toContain('<track');
  });

  it('does NOT render a track element when captionsUrl is empty string', () => {
    const html = renderVideoScreen({
      videoId: 'vid-1',
      streamUrl: 'https://example.com/s.mp4',
      captionsUrl: '',
    });
    expect(html).not.toContain('<track');
  });
});
