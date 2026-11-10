import { describe, it, expect } from 'vitest';
import { renderVideoScreen } from '../../src/ui/VideoScreen';

describe('VideoScreen', () => {
  it('should render video screen with correct attributes', () => {
    const props = {
      videoId: 'video-001',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      duration: 3600,
    };

    const html = renderVideoScreen(props);

    expect(html).toContain('video-screen');
    expect(html).toContain('video-video-001');
    expect(html).toContain('/stream/test.mp4');
    expect(html).toContain('controls');
    expect(html).toContain('autoplay');
  });

  it('should include progress bar and time display', () => {
    const props = {
      videoId: 'video-002',
      title: 'Test Video 2',
      streamUrl: '/stream/test2.mp4',
    };

    const html = renderVideoScreen(props);

    expect(html).toContain('progress-video-002');
    expect(html).toContain('time-video-002');
    expect(html).toContain('video-screen__progress-bar');
  });

  it('should handle missing duration gracefully', () => {
    const props = {
      videoId: 'video-003',
      title: 'Test Video 3',
      streamUrl: '/stream/test3.mp4',
    };

    const html = renderVideoScreen(props);

    expect(html).toContain('video-screen');
    expect(html).not.toContain('undefined');
  });
});
