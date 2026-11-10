/**
 * VideoScreen with an unbounded duration.
 *
 * Why this file exists: an `<video>` element reports `duration === Infinity` for a
 * live stream and `NaN` before its metadata has loaded, and `duration > 0` lets
 * Infinity through. Both values then reached `formatTime`, so a real LG webOS build
 * painted `0:30 / Infinity:NaN:NaN` in the time row, and the derived
 * `Math.round(ratio * duration)` wrote `aria-valuenow="NaN"` on a control that is
 * `role="slider"`. The render-time `aria-valuemax` carried the same disease,
 * stringifying `Infinity` straight into the attribute.
 *
 * Contract: a duration that is not a positive finite number is an unknown total.
 * The total then prints as `--:--`, the fill stays empty, no attribute carries
 * `NaN` or `Infinity`, and `aria-valuetext` still reports elapsed time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen, type VideoScreenProps } from '../../src/ui/VideoScreen';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';
import { createStorageAdapter } from '../../src/Adapter/Storage';

describe('VideoScreen with an unbounded (live) duration', () => {
  let storage: ReturnType<typeof createStorageAdapter>;
  let videoEl: HTMLVideoElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
    storage = createStorageAdapter();

    videoEl = document.createElement('video');
    videoEl.id = 'video-player';
    document.body.appendChild(videoEl);
    vi.spyOn(videoEl, 'play').mockResolvedValue(undefined as never);
    vi.spyOn(videoEl, 'pause').mockImplementation(() => {});
  });

  function mount(playerDuration: number, propDuration: number): HTMLDivElement {
    const player = createVideoPlayer(videoEl);
    vi.spyOn(player, 'getPosition').mockReturnValue(30);
    vi.spyOn(player, 'getDuration').mockReturnValue(playerDuration);
    return createVideoScreen({
      videoId: 'live-video',
      title: 'Live Service',
      streamUrl: '/stream/live.m3u8',
      duration: propDuration,
      player,
      storage,
    } as VideoScreenProps);
  }

  function timeText(screen: HTMLDivElement): string {
    return (screen.querySelector('.video-screen__time') as HTMLElement).textContent || '';
  }

  function progressBar(screen: HTMLDivElement): HTMLElement {
    return screen.querySelector('.video-screen__progress') as HTMLElement;
  }

  it('prints an unknown total at render time instead of Infinity:NaN:NaN', () => {
    const screen = mount(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    expect(timeText(screen)).toBe('0:00 / --:--');
    expect(screen.innerHTML).not.toMatch(/Infinity|NaN/);
  });

  it('does not stringify Infinity into aria-valuemax', () => {
    const bar = progressBar(mount(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY));
    const max = bar.getAttribute('aria-valuemax');
    expect(max ?? '').not.toMatch(/Infinity|NaN/);
  });

  it('keeps the fill empty and the ARIA value numeric while the stream runs', () => {
    const screen = mount(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const screenVideo = screen.querySelector('video') as HTMLVideoElement;
    screenVideo.dispatchEvent(new Event('timeupdate'));

    const bar = progressBar(screen);
    const now = bar.getAttribute('aria-valuenow') ?? '';
    expect(now).not.toMatch(/NaN|Infinity/);
    // The real pre-fix defect was aria-valuenow="NaN" and Infinity:NaN:NaN in the
    // time row; the fill simply never received a width. Either absent or 0% is an
    // empty bar, and neither may be a made-up percentage of an unknown total.
    expect(['', '0%']).toContain(
      (bar.querySelector('.video-screen__progress-bar') as HTMLElement).style.width
    );
    expect(timeText(screen)).toBe('0:30 / --:--');
    expect(bar.getAttribute('aria-valuetext') ?? '').toContain('0:30');
  });

  it('treats a not-yet-loaded NaN duration the same way', () => {
    const screen = mount(Number.NaN, 0);
    const screenVideo = screen.querySelector('video') as HTMLVideoElement;
    screenVideo.dispatchEvent(new Event('timeupdate'));
    expect(timeText(screen)).toBe('0:30 / --:--');
    expect(progressBar(screen).getAttribute('aria-valuenow') ?? '').not.toMatch(/NaN/);
  });

  it('keeps a normal finite duration exact, in seconds', () => {
    const screen = mount(120, 120);
    const screenVideo = screen.querySelector('video') as HTMLVideoElement;
    screenVideo.dispatchEvent(new Event('timeupdate'));
    expect(progressBar(screen).getAttribute('aria-valuenow')).toBe('30');
    expect(
      (progressBar(screen).querySelector('.video-screen__progress-bar') as HTMLElement).style.width
    ).toBe('25%');
    expect(timeText(screen)).toBe('0:30 / 2:00');
  });
});
