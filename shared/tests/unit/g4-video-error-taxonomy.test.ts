/**
 * G4 — Production video error taxonomy tests (TDD RED → GREEN).
 *
 * Covers the shared error renderer used by Tizen and Vizio
 * (webOS has its own inline implementation in platforms/webos/src/ui/VideoScreen.ts).
 *
 * Functions under test:
 *  - getVideoErrorState: maps HTMLMediaElement.error.code to a typed VideoErrorState
 *  - renderVideoErrorDialog: builds the DOM dialog with a retry button
 *  - attachVideoErrorHandling: wires an error listener and shows/updates the dialog
 *  - createVideoErrorI18n: creates a locale-aware translate function from platform storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVideoErrorState,
  renderVideoErrorDialog,
  attachVideoErrorHandling,
  createVideoErrorI18n,
  type VideoErrorState,
} from '@ctv/shared/ui/VideoErrorRenderer';
import { EN, ES } from '@ctv/core/i18n/I18n';

/** Minimal translate mock matching the actual EN strings from @ctv/core. */
function enT(key: string): string {
  const dict: Record<string, string> = {
    'error.video.title': 'Playback Error',
    'video_error.unexpected':
      'Something went wrong. Try again, or restart the app if it keeps happening.',
    'video_error.aborted': 'Video playback was aborted.',
    'video_error.network':
      'Network error while loading video. Please check your connection and try again.',
    'video_error.playback': 'Video format is not supported or corrupted.',
    'video_error.unsupported': 'Video source is not supported.',
    try_again: 'Try Again',
  };
  return dict[key] ?? key;
}

/**
 * Helper: create a video element with a specific error code.
 * jsdom does not populate HTMLMediaElement.error, so we define it explicitly.
 */
function makeVideoWithErrorCode(code: number | null): HTMLVideoElement {
  const v = document.createElement('video');
  if (code !== null) {
    Object.defineProperty(v, 'error', {
      value: { code },
      configurable: true,
    });
  }
  return v;
}

// ─── getVideoErrorState ───────────────────────────────────────────────────────

describe('G4: getVideoErrorState — HTMLMediaElement.error.code mapping', () => {
  it('maps MEDIA_ERR_ABORTED (1) to code "unknown" with aborted message', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(1), enT);
    expect(state.code).toBe('unknown');
    expect(state.message).toBe('Video playback was aborted.');
  });

  it('maps MEDIA_ERR_NETWORK (2) to code "network"', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(2), enT);
    expect(state.code).toBe('network');
    expect(state.message).toBe(
      'Network error while loading video. Please check your connection and try again.'
    );
  });

  it('maps MEDIA_ERR_DECODE (3) to code "playback"', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(3), enT);
    expect(state.code).toBe('playback');
    expect(state.message).toBe('Video format is not supported or corrupted.');
  });

  it('maps MEDIA_ERR_SRC_NOT_SUPPORTED (4) to code "unsupported"', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(4), enT);
    expect(state.code).toBe('unsupported');
    expect(state.message).toBe('Video source is not supported.');
  });

  it('returns code "unknown" with unexpected message when error is null', () => {
    const v = document.createElement('video'); // no error set
    const state = getVideoErrorState(v, enT);
    expect(state.code).toBe('unknown');
    expect(state.message).toBe(
      'Something went wrong. Try again, or restart the app if it keeps happening.'
    );
  });

  it('returns code "unknown" for unrecognized error code (5+)', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(5), enT);
    expect(state.code).toBe('unknown');
    expect(state.message).toBe(
      'Something went wrong. Try again, or restart the app if it keeps happening.'
    );
  });

  it('returns code "unknown" for negative error code', () => {
    const state = getVideoErrorState(makeVideoWithErrorCode(-1), enT);
    expect(state.code).toBe('unknown');
  });
});

// ─── renderVideoErrorDialog ───────────────────────────────────────────────────

describe('G4: renderVideoErrorDialog — DOM dialog builder', () => {
  it('returns a div with class "error-dialog"', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    expect(dialog.tagName).toBe('DIV');
    expect(dialog.classList.contains('error-dialog')).toBe(true);
  });

  it('includes a retry button with data-action="retry"', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    const btn = dialog.querySelector('[data-action="retry"]');
    expect(btn).toBeTruthy();
    expect(btn?.tagName).toBe('BUTTON');
  });

  it('displays the translated error title', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    const title = dialog.querySelector('.error-dialog__title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('Playback Error');
  });

  it('displays the mapped error message', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    const msg = dialog.querySelector('.error-dialog__message');
    expect(msg).toBeTruthy();
    expect(msg?.textContent).toBe('Network error.');
  });

  it('displays the translated "Try Again" button label', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    const btn = dialog.querySelector('[data-action="retry"]') as HTMLElement;
    expect(btn?.textContent).toBe('Try Again');
  });

  it('clicking retry removes the dialog from DOM and calls onRetry', () => {
    const onRetry = vi.fn();
    const state: VideoErrorState = {
      code: 'network',
      message: 'Network error.',
    };
    const dialog = renderVideoErrorDialog(state, enT, onRetry);
    document.body.appendChild(dialog);

    const btn = dialog.querySelector('[data-action="retry"]') as HTMLButtonElement;
    btn.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.error-dialog')).toBeNull();
  });

  it('escapes HTML in the error message (prevents XSS)', () => {
    const state: VideoErrorState = {
      code: 'network',
      message: '<img src=x onerror=alert(1)>',
    };
    const dialog = renderVideoErrorDialog(state, enT, vi.fn());
    const msg = dialog.querySelector('.error-dialog__message');
    // The raw HTML should NOT appear as a live <img> element
    expect(msg?.querySelector('img')).toBeNull();
    // The escaped version should be present in the HTML source
    expect(dialog.innerHTML).not.toContain('<img src=x onerror');
  });
});

// ─── attachVideoErrorHandling ─────────────────────────────────────────────────

describe('G4: attachVideoErrorHandling — Tizen/Vizio App integration', () => {
  let videoEl: HTMLVideoElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-video"><video id="video-player"></video></div>';
    videoEl = document.getElementById('video-player') as HTMLVideoElement;
  });

  it('shows an error dialog when the video element fires an error event', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 2 }, // MEDIA_ERR_NETWORK
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    const dialog = document.querySelector('.error-dialog');
    expect(dialog).toBeTruthy();
    const title = dialog?.querySelector('.error-dialog__title');
    expect(title?.textContent).toBe('Playback Error');

    cleanup();
  });

  it('dialog contains the correct network error message for error code 2', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 2 },
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    const msg = document.querySelector('.error-dialog .error-dialog__message') as HTMLElement;
    expect(msg?.textContent).toBe(
      'Network error while loading video. Please check your connection and try again.'
    );

    cleanup();
  });

  it('clicking retry removes the dialog once the retry is accepted', async () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 2 },
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    const dialog = document.querySelector('.error-dialog') as HTMLDivElement;
    expect(dialog).toBeTruthy();

    const playSpy = vi.spyOn(videoEl, 'play').mockReturnValue(Promise.resolve());

    const btn = dialog.querySelector('[data-action="retry"]') as HTMLButtonElement;
    btn.click();

    expect(playSpy).toHaveBeenCalled();
    // Dismissal now waits for the retry to be accepted, so the DOM change lands a
    // microtask after the click instead of inside the handler.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.error-dialog')).toBeNull();

    playSpy.mockRestore();
    cleanup();
  });

  it('cleanup() removes the error listener so subsequent errors show no dialog', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);
    cleanup();

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 2 },
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    expect(document.querySelector('.error-dialog')).toBeNull();
  });

  it('does not show a second dialog while one is already visible', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 2 },
      configurable: true,
    });

    // Fire error twice
    videoEl.dispatchEvent(new Event('error'));
    videoEl.dispatchEvent(new Event('error'));

    const dialogs = document.querySelectorAll('.error-dialog');
    expect(dialogs.length).toBe(1);

    cleanup();
  });

  it('showing a dialog for an unsupported (code 4) error works correctly', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mkv';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 4 }, // MEDIA_ERR_SRC_NOT_SUPPORTED
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    const msg = document.querySelector('.error-dialog .error-dialog__message') as HTMLElement;
    expect(msg?.textContent).toBe('Video source is not supported.');

    cleanup();
  });

  it('showing a dialog for a decode (code 3) error works correctly', () => {
    const cleanup = attachVideoErrorHandling(videoEl, enT);

    videoEl.src = '/stream/test.mp4';
    Object.defineProperty(videoEl, 'error', {
      value: { code: 3 }, // MEDIA_ERR_DECODE
      configurable: true,
    });
    videoEl.dispatchEvent(new Event('error'));

    const msg = document.querySelector('.error-dialog .error-dialog__message') as HTMLElement;
    expect(msg?.textContent).toBe('Video format is not supported or corrupted.');

    cleanup();
  });
});

// ─── createVideoErrorI18n — locale-aware translate from platform storage ─────

describe('G4: createVideoErrorI18n — self-contained locale handling', () => {
  const mockStorage = (locale: string | null): { get: (key: string) => string | null } => ({
    get(key: string) {
      return key === 'ctv_pref_locale' ? locale : null;
    },
  });

  it('defaults to English when no locale is stored', () => {
    const t = createVideoErrorI18n(mockStorage(null));
    // Reference core rather than re-typing the sentences: a literal here is another
    // place for the same string to drift. Exact-text parity is pinned in one place.
    expect(t('error.video.title')).toBe(EN['error.video.title']);
    expect(t('try_again')).toBe(EN['try_again']);
  });

  it('returns Spanish strings when locale is "es"', () => {
    const t = createVideoErrorI18n(mockStorage('es'));
    expect(t('error.video.title')).toBe(ES['error.video.title']);
    expect(t('try_again')).toBe(ES['try_again']);
    expect(t('video_error.unsupported')).toBe(ES['video_error.unsupported']);
  });

  it('falls back to English for unsupported locale values', () => {
    const t = createVideoErrorI18n(mockStorage('de'));
    expect(t('error.video.title')).toBe('Playback Error');
  });

  it('works without any storage (always English)', () => {
    const t = createVideoErrorI18n(undefined);
    expect(t('error.video.title')).toBe('Playback Error');
    expect(t('video_error.network')).toBe(
      'Network error while loading video. Please check your connection and try again.'
    );
  });

  it('returns the key itself for unknown keys (parity with core i18n)', () => {
    const t = createVideoErrorI18n(mockStorage(null));
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});

describe('F132: the renderer shows a stall indicator (Tizen/Vizio parity with webOS)', () => {
  /**
   * webOS turns the adapter's `buffering` state into a visible status row
   * (platforms/webos/src/ui/VideoScreen.ts L68-78, L200-203). Tizen and Vizio
   * ship this renderer instead, so the row has to live here: it is the only
   * module App attaches to #video-player on those platforms. A stall that
   * renders nothing is a frozen frame on a real set.
   */
  const storeWith = (locale: string | null): { get: (key: string) => string | null } => ({
    get: () => locale,
  });

  function mountScreen(locale: 'en' | 'es' | null = 'en') {
    document.body.innerHTML =
      '<div id="screen-video" class="screen"><video id="video-player"></video></div>';
    const video = document.getElementById('video-player') as HTMLVideoElement;
    const cleanup = attachVideoErrorHandling(video, createVideoErrorI18n(storeWith(locale)));
    return { video, cleanup };
  }

  it('adds a hidden status row when attached', () => {
    const { cleanup } = mountScreen();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement | null;
    expect(row, 'no .video-buffering row was added next to the player').not.toBeNull();
    expect(row!.getAttribute('role')).toBe('status');
    expect(row!.getAttribute('aria-live')).toBe('polite');
    expect(row!.style.display).toBe('none');
    cleanup();
  });

  it('shows the row on waiting/stalled and hides it on playing/canplay', () => {
    const { video, cleanup } = mountScreen();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement;

    video.dispatchEvent(new Event('waiting'));
    expect(row.style.display).toBe('flex');
    video.dispatchEvent(new Event('playing'));
    expect(row.style.display).toBe('none');
    video.dispatchEvent(new Event('stalled'));
    expect(row.style.display).toBe('flex');
    video.dispatchEvent(new Event('canplay'));
    expect(row.style.display).toBe('none');
    cleanup();
  });

  it('hides the row when playback errors, as the webOS state model does', () => {
    // webOS shows the row only while the adapter state is `buffering`
    // (platforms/webos/src/ui/VideoScreen.ts L200-203): any other state, error
    // included, hides it. This renderer hid it only on resume, so a stall that ended
    // in a failure left "Buffering…" painted over a frozen frame while the error
    // dialog was up - two contradictory messages about the same picture.
    const { video, cleanup } = mountScreen();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement;

    video.dispatchEvent(new Event('waiting'));
    expect(row.style.display).toBe('flex');
    video.dispatchEvent(new Event('error'));
    expect(row.style.display, 'the row is still visible after the stream failed').toBe('none');
    cleanup();
  });

  it('hides the row when the viewer pauses or the stream ends', () => {
    // A stall the viewer pauses on is paused, not buffering; so is the last frame of a
    // finished stream. webOS hides for both (its adapter reports `paused`/`stopped`).
    const { video, cleanup } = mountScreen();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement;

    video.dispatchEvent(new Event('stalled'));
    expect(row.style.display).toBe('flex');
    video.dispatchEvent(new Event('pause'));
    expect(row.style.display).toBe('none');

    video.dispatchEvent(new Event('waiting'));
    expect(row.style.display).toBe('flex');
    video.dispatchEvent(new Event('ended'));
    expect(row.style.display).toBe('none');
    cleanup();
  });

  it('keeps the dialog when the retry play is rejected', async () => {
    // The retry button used to tear the dialog down before knowing whether play() was
    // accepted. A rejected play - autoplay policy, or the same dead source - left the
    // viewer with a frozen frame, no dialog and no affordance but Back, which
    // contradicts the comment on the catch it was caught in.
    const { video, cleanup } = mountScreen();
    video.play = () => Promise.reject(new Error('MEDIA_ERR_SRC_NOT_SUPPORTED'));
    video.dispatchEvent(new Event('error'));

    const btn = document.querySelector('[data-action="retry"]') as HTMLButtonElement | null;
    expect(btn, 'no retry button appeared after the error').not.toBeNull();
    btn!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      document.querySelector('.error-dialog-container'),
      'a failed retry removed the dialog, so nothing on screen explains or recovers the failure'
    ).not.toBeNull();
    cleanup();
  });

  it('removes the dialog when the retry play is accepted', async () => {
    const { video, cleanup } = mountScreen();
    video.play = () => Promise.resolve();
    video.dispatchEvent(new Event('error'));

    const btn = document.querySelector('[data-action="retry"]') as HTMLButtonElement;
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.error-dialog-container')).toBeNull();
    cleanup();
  });

  it('cleanup removes the row and detaches the media listeners', () => {
    const { video, cleanup } = mountScreen();
    cleanup();
    expect(document.querySelector('.video-buffering')).toBeNull();
    expect(() => video.dispatchEvent(new Event('waiting'))).not.toThrow();
    expect(document.querySelector('.video-buffering')).toBeNull();
  });

  it('every embedded string matches core i18n so locales stay in parity', () => {
    // The renderer ships its own copy of these strings so the lazy chunk does not pull
    // the whole app dictionary into the main bundle. A copy that drifts is a live
    // wrong-text bug on screen, not a style nit, so every key is pinned in both
    // locales against core - not just the buffering row.
    const VIDEO_ERROR_KEYS = [
      'error.video.title',
      'video_error.unexpected',
      'video_error.aborted',
      'video_error.network',
      'video_error.playback',
      'video_error.unsupported',
      'try_again',
      'video.buffering',
    ] as const;
    const en = createVideoErrorI18n(storeWith(null));
    const es = createVideoErrorI18n(storeWith('es'));
    for (const key of VIDEO_ERROR_KEYS) {
      expect(en(key), `EN drift on "${key}"`).toBe(EN[key]);
      expect(es(key), `ES drift on "${key}"`).toBe(ES[key]);
    }
  });
});
