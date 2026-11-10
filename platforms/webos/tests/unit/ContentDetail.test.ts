/**
 * WebOS ContentDetail UI component — unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContentDetail } from '../../src/ui/ContentDetail';

describe('ContentDetail', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'content-detail';
    container.className = 'content-detail';
    document.body.appendChild(container);
  });

  it('renders a content-detail wrapper div', () => {
    const el = createContentDetail({
      videoId: 'video-123',
      title: 'Test Video',
      description: 'desc',
      thumbnail: 'https://example.com/detail.jpg',
      streamUrl: '/stream/test.mp4',
    });
    expect(el.className).toContain('content-detail');
  });

  it('renders the video title', () => {
    const el = createContentDetail({
      videoId: 'video-123',
      title: 'Test Video',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const titleEl = el.querySelector('.content-detail__title');
    expect(titleEl).toBeTruthy();
    expect(titleEl?.textContent).toBe('Test Video');
  });

  it('renders the poster background', () => {
    const el = createContentDetail({
      videoId: 'video-123',
      title: 'Test',
      description: 'desc',
      thumbnail: 'https://example.com/detail.jpg',
      streamUrl: '/s.mp4',
    });
    const poster = el.querySelector('.content-detail__poster');
    expect(poster).toBeTruthy();
    expect(poster?.style.backgroundImage).toContain('detail.jpg');
  });

  it('renders a play button', () => {
    const el = createContentDetail({
      videoId: 'video-123',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const playBtn = el.querySelector('.content-detail__btn--play');
    expect(playBtn).toBeTruthy();
    expect(playBtn?.textContent).toContain('Play');
  });

  it('renders action buttons container', () => {
    const el = createContentDetail({
      videoId: 'video-123',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const actions = el.querySelector('.content-detail__actions');
    expect(actions).toBeTruthy();
  });

  it('escapes HTML in title', () => {
    const el = createContentDetail({
      videoId: 'xss',
      title: '<script>alert(1)</script>',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const titleEl = el.querySelector('.content-detail__title') as HTMLElement;
    expect(titleEl).toBeTruthy();
    // textContent should contain the escaped version
    expect(titleEl.textContent).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('handles empty values', () => {
    const el = createContentDetail({
      videoId: '',
      title: '',
      description: '',
      thumbnail: '',
      streamUrl: '',
    });
    expect(el.className).toContain('content-detail');
  });

  it('renders duration when available', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
      content: { duration: 3661 },
    });
    const durationEl = el.querySelector('.content-detail__duration');
    expect(durationEl).toBeTruthy();
    expect(durationEl?.textContent).toBe('1h 1m');
  });

  it('renders genres joined with bullets', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
      genres: ['Drama', 'Thriller'],
    });
    const genresEl = el.querySelector('.content-detail__genres');
    expect(genresEl).toBeTruthy();
    expect(genresEl?.textContent).toBe('Drama · Thriller');
  });

  it('renders description when provided', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
      shortDescription: 'A great video about stuff',
    });
    const descEl = el.querySelector('.content-detail__description');
    expect(descEl).toBeTruthy();
    expect(descEl?.textContent).toBe('A great video about stuff');
  });

  it('does not render description when empty', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const descEl = el.querySelector('.content-detail__description');
    expect(descEl).toBeNull();
  });

  it('calls onPlay callback when play button clicked', () => {
    const onPlay = vi.fn();
    const el = createContentDetail(
      {
        videoId: 'v1',
        title: 'Test',
        description: 'desc',
        thumbnail: 't.jpg',
        streamUrl: '/s.mp4',
      },
      { onPlay }
    );
    const playBtn = el.querySelector('#btn-play') as HTMLButtonElement;
    playBtn?.click();
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('play button has correct ARIA label', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'My Video',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const playBtn = el.querySelector('#btn-play') as HTMLButtonElement;
    expect(playBtn?.getAttribute('aria-label')).toBe('Play My Video');
  });

  it('play button is focusable', () => {
    const el = createContentDetail({
      videoId: 'v1',
      title: 'My Video',
      description: 'desc',
      thumbnail: 't.jpg',
      streamUrl: '/s.mp4',
    });
    const playBtn = el.querySelector('#btn-play') as HTMLButtonElement;
    expect(playBtn?.tabIndex).toBe(0);
  });
});
