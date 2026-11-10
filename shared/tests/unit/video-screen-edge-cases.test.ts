/**
 * VideoScreen — edge-case tests.
 * Tests playback states, error handling, and layout variations.
 */

import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '@ctv/shared/ui/VideoScreen';

describe('VideoScreen edge cases', () => {
  const baseProps = {
    videoId: 'v1',
    title: 'Test Video',
    streamUrl: '/stream.mp4',
  };

  it('renders without title', () => {
    const html = renderVideoScreen({ ...baseProps, title: '' });
    expect(html).toContain('video-screen');
  });

  it('renders with duration 0', () => {
    const html = renderVideoScreen({ ...baseProps, duration: 0 });
    expect(html).toContain('video-screen');
  });

  it('renders with very large duration', () => {
    const html = renderVideoScreen({ ...baseProps, duration: 999999 });
    expect(html).toContain('video-screen');
  });

  it('handles unicode title in video screen', () => {
    const html = renderVideoScreen({ ...baseProps, title: '🎬 Movie Title' });
    expect(html).toContain('🎬');
  });

  it('escapes XSS in title', () => {
    const html = renderVideoScreen({ ...baseProps, title: '<b>Bold</b>' });
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders with external player URL', () => {
    const html = renderVideoScreen({ ...baseProps, externalPlayerUrl: 'intent://play' });
    expect(html).toContain('intent://play');
  });

  it('renders resume banner with position', () => {
    const html = renderVideoScreen({ ...baseProps, position: 60, duration: 600 });
    expect(html).toContain('video-screen__resume');
  });

  it('does not render resume banner when position is 0', () => {
    const html = renderVideoScreen({ ...baseProps, position: 0, duration: 600 });
    expect(html).not.toContain('video-screen__resume');
  });

  it('renders progress bar at custom position', () => {
    const html = renderVideoScreen({ ...baseProps, position: 30, duration: 60 });
    expect(html).toContain('video-screen__progress');
    expect(html).toContain('50%');
  });

  it('renders back button', () => {
    const html = renderVideoScreen({ ...baseProps, onBack: () => {} });
    expect(html).toContain('video-screen__back');
  });

  it('handles description with HTML', () => {
    const html = renderVideoScreen({
      ...baseProps,
      description: 'A <b>bold</b> description',
    });
    expect(html).toContain('video-screen');
  });
});
