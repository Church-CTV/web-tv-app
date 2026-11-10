/**
 * VideoScreen: what the viewer sees when playback fails or stalls.
 *
 * Why this file exists: `showVideoError()` showed its dialog without ever
 * pausing, stopping or unloading the `<video>`, and the full-screen container
 * that holds the dialog (`.video-error`) had inline geometry but no background
 * anywhere in the shipped stylesheet. On a transient stream error the buffered
 * stream therefore kept advancing *behind and around* the small opaque dialog —
 * a store reviewer watching a playback failure sees a live picture playing
 * under a "playback failed" message. Separately, the platform adapter already
 * reports `buffering` on `waiting` (`Adapter/VideoPlayer.ts` `onWaiting` ->
 * `notifyState`), but the screen never subscribed to `onStateChange`, so a
 * mid-playback stall rendered as a silent frozen frame with no acknowledgement.
 *
 * Contract:
 *   - A playback error pauses the element before the dialog is shown, and the
 *     dialog's container dims what is behind it.
 *   - `buffering` from the player shows a "Buffering…" indicator; any other
 *     state hides it again.
 *   - Tearing the screen down releases the player subscription, because the
 *     app's player outlives every screen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoScreen, type VideoScreenProps } from '../../src/ui/VideoScreen';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';
import { createStorageAdapter } from '../../src/Adapter/Storage';

// Resolved from this file, not the process cwd: the pre-commit hook and CI run the
// webOS suite with cwd = platforms/webos, where a repo-relative literal misses.
const STYLE_PATH = resolve(__dirname, '../../src/styles.css');

describe('VideoScreen playback failure and stall feedback', () => {
  let storage: ReturnType<typeof createStorageAdapter>;
  let sharedVideoEl: HTMLVideoElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
    storage = createStorageAdapter();

    // The app shell keeps one persistent element. The screen creates its own
    // unless `videoElId` is passed (J5: exactly one live <video>, inside the
    // visible screen), so every event below must target the element the screen
    // actually bound, not this one.
    sharedVideoEl = document.createElement('video');
    sharedVideoEl.id = 'video-player';
    document.body.appendChild(sharedVideoEl);
  });

  /** Mount the screen and return the `<video>` it bound, with jsdom's */
  /** unimplemented media methods stubbed on that element. */
  function mount(): { screen: HTMLDivElement; media: HTMLVideoElement } {
    const player = createVideoPlayer(sharedVideoEl);
    vi.spyOn(player, 'getPosition').mockReturnValue(30);
    vi.spyOn(player, 'getDuration').mockReturnValue(1800);
    const screen = createVideoScreen({
      videoId: 'sermon-1',
      title: 'Sunday Service',
      streamUrl: '/stream/sermon-1.m3u8',
      duration: 1800,
      player,
      storage,
    } as VideoScreenProps);
    const media = (screen.querySelector('video') ?? sharedVideoEl) as HTMLVideoElement;
    vi.spyOn(media, 'pause').mockImplementation(() => {});
    vi.spyOn(media, 'load').mockImplementation(() => {});
    vi.spyOn(media, 'play').mockResolvedValue(undefined as never);
    document.body.append(screen);
    return { screen, media };
  }

  function errorContainer(screen: HTMLDivElement): HTMLElement {
    return screen.querySelector('.video-error') as HTMLElement;
  }

  // === F5: a failed stream must stop moving, and must not show through ===

  it('pauses playback when the error dialog is shown', () => {
    const { screen, media } = mount();
    media.dispatchEvent(new Event('error'));
    expect(media.pause).toHaveBeenCalled();
    expect(errorContainer(screen).style.display).toBe('flex');
  });

  it('clears the error layer only after retry succeeds', async () => {
    const { screen, media } = mount();
    media.dispatchEvent(new Event('error'));
    const retry = screen.querySelector('.error-dialog [data-action="retry"]') as HTMLElement;
    expect(retry).not.toBeNull();
    retry.click();
    await vi.waitFor(() => expect(errorContainer(screen).style.display).toBe('none'));
  });

  it('focuses Retry and preserves the dialog through pending and rejected retries', async () => {
    const { screen, media } = mount();
    media.focus();
    media.dispatchEvent(new Event('error'));
    const retry = screen.querySelector('[data-action="retry"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(retry);
    expect(retry.closest('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    let reject!: (error: Error) => void;
    vi.mocked(media.play).mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        })
    );
    retry.click();
    retry.click();
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(errorContainer(screen).style.display).toBe('flex');
    expect(media.load).not.toHaveBeenCalled();
    reject(new Error('offline'));
    await vi.waitFor(() => expect(retry.hasAttribute('aria-disabled')).toBe(false));
    expect(errorContainer(screen).style.display).toBe('flex');
    expect(document.activeElement).toBe(retry);
    retry.click();
    await vi.waitFor(() => expect(errorContainer(screen).style.display).toBe('none'));
    expect(document.activeElement).toBe(media);
  });

  it('dims what is behind the dialog in the shipped stylesheet', () => {
    // The container gets its geometry inline, so the only place a backdrop can
    // live is the built CSS. A transparent backdrop is the defect, so assert
    // the shipped bytes actually paint one.
    const css = readFileSync(STYLE_PATH, 'utf8');
    const rule = css.match(/\.video-error\s*{[^}]*}/);
    expect(rule, 'the shipped sheet has no .video-error rule at all').not.toBeNull();
    const background = rule![0].match(/background(?:-color)?:\s*([^;]+);/);
    expect(background, '.video-error declares no background').not.toBeNull();
    expect(background![1].trim()).toMatch(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0?\.\d+\s*\)$/);
  });

  // === F7: a stall must be acknowledged on screen ===

  it('shows a buffering indicator while the player reports buffering', () => {
    const { screen, media } = mount();
    const indicator = screen.querySelector('.video-buffering') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.getAttribute('role')).toBe('status');
    expect(indicator.style.display).toBe('none');

    media.dispatchEvent(new Event('waiting'));
    expect(indicator.style.display).toBe('flex');
    expect(indicator.textContent).toMatch(/buffering/i);

    media.dispatchEvent(new Event('canplay'));
    expect(indicator.style.display).toBe('none');
  });

  it('does not show the indicator during normal playback', () => {
    const { screen, media } = mount();
    media.dispatchEvent(new Event('play'));
    media.dispatchEvent(new Event('canplay'));
    const indicator = screen.querySelector('.video-buffering') as HTMLElement;
    expect(indicator.style.display).toBe('none');
  });

  it('releases its player subscription when the screen is torn down', () => {
    // The player is app-shared and outlives the screen, so a subscription that
    // cleanup never removed would accumulate one closure per video opened.
    const player = createVideoPlayer(sharedVideoEl);
    const off = vi.spyOn(player, 'offStateChange').mockImplementation(() => {});
    const screen = createVideoScreen({
      videoId: 'sermon-2',
      title: 'Bible Study',
      streamUrl: '/stream/sermon-2.m3u8',
      duration: 1200,
      player,
      storage,
    } as VideoScreenProps) as HTMLDivElement & { cleanup: () => void };
    screen.cleanup();
    expect(off).toHaveBeenCalledTimes(1);
  });
});
