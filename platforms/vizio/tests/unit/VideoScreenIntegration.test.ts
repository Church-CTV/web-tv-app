/**
 * Vizio VideoScreenIntegration — Position tracking tests.
 */

import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '../../../../shared/ui/VideoScreen';

describe('Vizio VideoScreenIntegration', () => {
  it('renders video screen in container', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('.video-screen')).toBeTruthy();
  });

  it('renders video with id matching videoId', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'My Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('video-v1');
  });

  it('renders progress bar', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('.video-screen__progress')).toBeTruthy();
  });

  it('renders with time display and total duration', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
      duration: 1800,
    });
    expect(html).toContain('0:00 / 30:00');
  });

  it('renders with default duration when none provided', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test Video',
      streamUrl: '/stream/v1.mp4',
    });
    expect(html).toContain('0:00');
  });
});
