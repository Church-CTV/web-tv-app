/**
 * Shared video progress fill.
 *
 * Why this file exists: Tizen and Vizio do not have their own video screen, they
 * re-export this one (`platforms/tizen/src/ui/VideoScreen.ts:4`,
 * `platforms/vizio/src/ui/VideoScreen.ts:4`), so a progress bar bug here ships on
 * both stores. The webOS twin carries the same contract and is pinned in
 * `platforms/webos/tests/unit/VideoScreenExternalPlayer.test.ts`; before this file
 * the shared layer had no test at all and wrote a fill width straight from
 * `currentTime / duration`, which is above 100% whenever a stored resume point has
 * drifted past the end of the media (the Continue Watching screen's whole subject)
 * and an invalid CSS value the browser silently drops when the position is negative.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initVideoScreen, renderVideoScreen } from './VideoScreen';
import { initContinueWatchingVideoScreen } from './ContinueWatchingVideoScreen';

const VIDEO_ID = 'v1';

function mountVideo(currentTime: number, duration: number): HTMLVideoElement {
  document.body.innerHTML =
    `<video id="video-${VIDEO_ID}"></video>` +
    `<div id="progress-${VIDEO_ID}"><div class="video-screen__progress-bar" style="width:0%"></div></div>` +
    `<div id="time-${VIDEO_ID}"></div>`;
  const videoEl = document.getElementById(`video-${VIDEO_ID}`) as HTMLVideoElement;
  Object.defineProperty(videoEl, 'currentTime', { get: () => currentTime, configurable: true });
  Object.defineProperty(videoEl, 'duration', { get: () => duration, configurable: true });
  return videoEl;
}

function tick(videoEl: HTMLVideoElement): string {
  videoEl.dispatchEvent(new Event('timeupdate'));
  return (document.querySelector('.video-screen__progress-bar') as HTMLElement).style.width;
}

function timeText(): string {
  return (document.getElementById(`time-${VIDEO_ID}`) as HTMLElement).textContent || '';
}

describe.each([
  ['VideoScreen', initVideoScreen],
  ['ContinueWatchingVideoScreen', initContinueWatchingVideoScreen],
])('%s progress fill', (_name, init) => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('clamps the fill when the playhead runs past the duration', () => {
    const videoEl = mountVideo(300, 120);
    init(VIDEO_ID, 120);
    expect(tick(videoEl)).toBe('100%');
  });

  it('never writes a negative width, which the browser drops silently', () => {
    // `width:-4.16%` is not a valid declaration: jsdom (like a TV webview) keeps the
    // previous value, so the fill looked frozen instead of empty.
    const videoEl = mountVideo(-5, 120);
    init(VIDEO_ID, 120);
    expect(tick(videoEl)).toBe('0%');
  });

  it('keeps an in-range playhead exact', () => {
    const videoEl = mountVideo(60, 120);
    init(VIDEO_ID, 120);
    expect(tick(videoEl)).toBe('50%');
  });

  it('leaves the fill alone when the duration is still unknown', () => {
    const videoEl = mountVideo(30, Number.NaN);
    init(VIDEO_ID, 120);
    expect(tick(videoEl)).toBe('0%');
  });

  it('shows an unknown total, not Infinity:NaN:NaN, on a live stream', () => {
    // HTMLMediaElement.duration is Infinity for a live stream, and `dur > 0` lets
    // Infinity through, so the time row used to paint `0:30 / Infinity:NaN:NaN`.
    const videoEl = mountVideo(30, Number.POSITIVE_INFINITY);
    init(VIDEO_ID, Number.POSITIVE_INFINITY);
    expect(tick(videoEl)).toBe('0%');
    const text = timeText();
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(text).toContain('--:--');
    expect(text).toContain('0:30');
  });
});

describe('renderVideoScreen initial progress', () => {
  const base = { videoId: 'v1', streamUrl: 'https://example.test/manifest.m3u8' };

  it('clamps the initial main fill when the resume point is past the end', () => {
    // shared/ui/VideoScreen.ts derived the initial width straight from
    // position / duration, so a drifted resume point painted width:250% before the
    // first timeupdate ever fired.
    const html = renderVideoScreen({ ...base, duration: 100, position: 250 });
    const m = html.match(/class="video-screen__progress-bar" style="width:([^"]+)"/);
    expect(m?.[1]).toBe('100%');
  });

  it('clamps the resume-banner fill with the same rule', () => {
    const html = renderVideoScreen({ ...base, duration: 100, position: 250 });
    const m = html.match(/class="video-screen__resume-progress-bar" style="width:([^"]+)"/);
    expect(m?.[1]).toBe('100%');
  });

  it('omits the resume banner when the duration is unknown', () => {
    const html = renderVideoScreen({ ...base, duration: Number.POSITIVE_INFINITY, position: 30 });
    expect(html).not.toContain('video-screen__resume');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('prints an unknown total instead of Infinity:NaN:NaN in the time row', () => {
    const html = renderVideoScreen({ ...base, duration: Number.POSITIVE_INFINITY, position: 0 });
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain('--:--');
  });

  it('keeps a normal resume point exact', () => {
    const html = renderVideoScreen({ ...base, duration: 200, position: 50 });
    const bar = html.match(/class="video-screen__progress-bar" style="width:([^"]+)"/)?.[1];
    const banner = html.match(
      /class="video-screen__resume-progress-bar" style="width:([^"]+)"/
    )?.[1];
    expect(bar).toBe('25%');
    expect(banner).toBe('25%');
  });
});
