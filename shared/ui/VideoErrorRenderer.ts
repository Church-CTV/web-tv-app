/**
 * Shared Video Error Renderer — production error taxonomy for Tizen and Vizio.
 *
 * Maps HTMLMediaElement.error.code to a typed VideoErrorState and renders
 * a localised error dialog with a retry button.
 *
 * This module is intentionally SELF-CONTAINED (no @ctv/core imports) so it can
 * live in shared/ui and be pulled into small bundles without dragging in the
 * full app i18n dictionaries. It embeds the six video-error strings plus the
 * one stall-feedback string (F132) and reads the active locale from storage to
 * stay consistent with app-wide locale settings (en/es).
 *
 * webOS uses its own inline implementation in platforms/webos/src/ui/VideoScreen.ts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoErrorState {
  code: 'network' | 'playback' | 'unsupported' | 'unknown';
  message: string;
}

export type TranslateFn = (key: string) => string;

// ─── Inline error-only dictionaries (EN/ES) ───────────────────────────────────
// A copy of the video-error subset of @ctv/core i18n, kept out of the main bundle so
// the lazy chunk does not import the whole dictionary. Exact text is pinned against
// core by shared/tests/unit/g4-video-error-taxonomy.test.ts: editing one side without
// the other fails that test rather than shipping two different sentences.

const LOCALE_KEY = 'ctv_pref_locale';

const EN: Record<string, string> = {
  'error.video.title': 'Playback Error',
  'video_error.unexpected':
    'Something went wrong. Try again, or restart the app if it keeps happening.',
  'video_error.aborted': 'Video playback was aborted.',
  'video_error.network':
    'Network error while loading video. Please check your connection and try again.',
  'video_error.playback': 'Video format is not supported or corrupted.',
  'video_error.unsupported': 'Video source is not supported.',
  try_again: 'Try Again',
  'video.buffering': 'Buffering…',
};

const ES: Record<string, string> = {
  'error.video.title': 'Error de reproducción',
  'video_error.unexpected':
    'Algo salió mal. Inténtalo de nuevo; si el problema continúa, reinicia la aplicación.',
  'video_error.aborted': 'La reproducción del video se abortó.',
  'video_error.network':
    'Error de red al cargar el video. Comprueba tu conexión e inténtalo de nuevo.',
  'video_error.playback': 'El formato del video no está soportado o está dañado.',
  'video_error.unsupported': 'La fuente del video no está soportada.',
  try_again: 'Intentar de nuevo',
  'video.buffering': 'Cargando…',
};

/**
 * Minimal storage shape (enough to read the stored locale).
 */
interface LocaleStore {
  get(key: string): string | null;
}

function resolveLocale(store?: LocaleStore): 'en' | 'es' {
  const stored = store?.get(LOCALE_KEY);
  if (stored === 'es') return 'es';
  return 'en';
}

/**
 * Create a TranslateFn that returns the video-error strings in the active
 * locale. Honors the stored locale (ctv_pref_locale) so the dialog matches
 * app-wide locale settings. Pass undefined to always use English.
 */
export function createVideoErrorI18n(store?: LocaleStore): TranslateFn {
  const locale = resolveLocale(store);
  const dict = locale === 'es' ? ES : EN;
  return (key: string): string => dict[key] ?? EN[key] ?? key;
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Map a video element's HTMLMediaElement.error to a VideoErrorState.
 * Mirrors webOS getVideoError() for parity.
 */
export function getVideoErrorState(videoEl: HTMLVideoElement, t: TranslateFn): VideoErrorState {
  const err = videoEl.error;
  if (!err) return { code: 'unknown', message: t('video_error.unexpected') };

  switch (err.code) {
    case 1: // MEDIA_ERR_ABORTED
      return { code: 'unknown', message: t('video_error.aborted') };
    case 2: // MEDIA_ERR_NETWORK
      return { code: 'network', message: t('video_error.network') };
    case 3: // MEDIA_ERR_DECODE
      return { code: 'playback', message: t('video_error.playback') };
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return { code: 'unsupported', message: t('video_error.unsupported') };
    default:
      return { code: 'unknown', message: t('video_error.unexpected') };
  }
}

/**
 * Build a self-contained error dialog DOM element.
 * The retry button calls onRetry() and removes the dialog only once the retry is
 * accepted. A retry that reports failure (a rejected `play()`) leaves the dialog up:
 * the failure is still in front of the viewer and Back is the only other control on
 * this screen, so removing the dialog on a refused retry left a frozen frame with no
 * message and no way to try again.
 */
export function renderVideoErrorDialog(
  state: VideoErrorState,
  t: TranslateFn,
  onRetry: () => void | Promise<void>
): HTMLDivElement & { activate: () => void; cleanup: () => void } {
  const dialog = document.createElement('div');
  dialog.className = 'error-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('error.video.title'));

  const title = document.createElement('h2');
  title.className = 'error-dialog__title';
  title.textContent = t('error.video.title');
  dialog.appendChild(title);

  const msg = document.createElement('p');
  msg.className = 'error-dialog__message';
  msg.textContent = state.message;
  dialog.appendChild(msg);

  const btn = document.createElement('button');
  btn.className = 'error-dialog__button';
  btn.dataset.action = 'retry';
  btn.textContent = t('try_again');
  let pending = false;
  let disposed = false;
  let previousFocus: HTMLElement | null = null;
  let mountObserver: MutationObserver | null = null;
  const containFocus = (event: FocusEvent) => {
    if (dialog.isConnected && !dialog.contains(event.target as Node)) btn.focus();
  };
  const containKeys = (event: KeyboardEvent) => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow')) {
      event.preventDefault();
      event.stopPropagation();
      btn.focus();
    }
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    mountObserver?.disconnect();
    document.removeEventListener('focusin', containFocus);
    dialog.removeEventListener('keydown', containKeys);
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const activate = () => {
    if (disposed) return;
    if (!dialog.isConnected) {
      mountObserver?.disconnect();
      mountObserver = new MutationObserver(() => {
        if (dialog.isConnected) {
          mountObserver?.disconnect();
          activate();
        }
      });
      mountObserver.observe(document.body, { childList: true, subtree: true });
      return;
    }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('focusin', containFocus);
    dialog.addEventListener('keydown', containKeys);
    btn.focus();
  };
  btn.addEventListener('click', async () => {
    if (pending || disposed) return;
    pending = true;
    btn.setAttribute('aria-disabled', 'true');
    dialog.setAttribute('aria-busy', 'true');
    try {
      const result = onRetry();
      if (result) await result;
      if (disposed) return;
      cleanup();
      dialog.remove();
    } catch {
      // A refused or synchronously throwing retry keeps the actionable error visible.
      if (!disposed && dialog.isConnected) btn.focus();
    } finally {
      pending = false;
      btn.removeAttribute('aria-disabled');
      dialog.removeAttribute('aria-busy');
    }
  });
  dialog.appendChild(btn);

  return Object.assign(dialog, { activate, cleanup });
}

/**
 * F132: acknowledge a stall on screen.
 *
 * The adapters already emit `buffering` on `waiting`/`stalled` and webOS turns
 * that state into a visible status row (platforms/webos/src/ui/VideoScreen.ts
 * L68-78, L200-203). On Tizen and Vizio nothing subscribed, so a network stall
 * on a real set was a frozen frame with no acknowledgement at all. This row is
 * the counterpart for those platforms; it rides in the same lazy chunk as the
 * error dialog so the main bundle keeps its i18n budget.
 */
export function attachVideoBufferingIndicator(
  videoEl: HTMLVideoElement,
  t: TranslateFn = (key) => key
): () => void {
  const container = videoEl.parentElement ?? document.body;

  const row = document.createElement('div');
  row.className = 'video-buffering';
  row.setAttribute('role', 'status');
  row.setAttribute('aria-live', 'polite');
  row.style.display = 'none';
  // Same parity convention as createVideoErrorI18n: an unresolved key falls
  // back to the key itself rather than an empty status row.
  row.textContent = t('video.buffering') || 'video.buffering';
  container.appendChild(row);

  const show = () => {
    row.style.display = 'flex';
  };
  const hide = () => {
    row.style.display = 'none';
  };

  videoEl.addEventListener('waiting', show);
  videoEl.addEventListener('stalled', show);
  videoEl.addEventListener('playing', hide);
  videoEl.addEventListener('canplay', hide);
  // webOS shows this row only while the player state is `buffering`
  // (platforms/webos/src/ui/VideoScreen.ts L200-203). Hiding on resume alone left the
  // row painted over a frozen frame whenever the stall ended some other way: an error
  // (the row then contradicted the error dialog sitting on top of it), a viewer pause,
  // or the end of the stream. Every hide below is symmetrical with a show above, so
  // teardown cannot leave a visible row on a detached listener.
  videoEl.addEventListener('error', hide);
  videoEl.addEventListener('pause', hide);
  videoEl.addEventListener('ended', hide);

  return () => {
    videoEl.removeEventListener('waiting', show);
    videoEl.removeEventListener('stalled', show);
    videoEl.removeEventListener('playing', hide);
    videoEl.removeEventListener('canplay', hide);
    videoEl.removeEventListener('error', hide);
    videoEl.removeEventListener('pause', hide);
    videoEl.removeEventListener('ended', hide);
    row.remove();
  };
}

/**
 * Attach an error listener to a video element that shows a localised error
 * dialog when playback fails. Returns a cleanup function that removes the
 * listener and any visible dialog.
 *
 * Used by Tizen and Vizio App entry points. Pass a TranslateFn (e.g. from
 * createVideoErrorI18n) for locale support; defaults to English.
 */
export function attachVideoErrorHandling(
  videoEl: HTMLVideoElement,
  t: TranslateFn = () => ''
): () => void {
  let activeDialog: ReturnType<typeof renderVideoErrorDialog> | null = null;
  let disposed = false;
  let activeOverlay: HTMLDivElement | null = null;

  const showError = () => {
    // Guard against duplicate dialogs
    if (disposed || activeDialog) return;

    // Stop the picture before the dialog appears: the overlay dims what is
    // behind it, but a paused-looking message over a still-advancing stream
    // reads as a different failure than the one that happened.
    videoEl.pause();

    // Video's parent container (e.g. #screen-video)
    const container = videoEl.parentElement ?? document.body;

    const state = getVideoErrorState(videoEl, t);

    const onRetry = async () => {
      // `play()` rejects when the retry never started: autoplay policy, or the same
      // source that failed. Letting that rejection escape keeps the dialog visible,
      // which is the point - the old code removed the dialog either way and the
      // comment on its catch claimed the opposite.
      if (disposed) return;
      if (videoEl.error) videoEl.load();
      await videoEl.play();
      if (disposed || activeDialog !== dialog) return;
      // Only an accepted retry retires the overlay: it is the dimmed layer, so it is
      // the node that has to go when the dialog is dismissed. Removing only the dialog
      // used to leave an empty full-screen layer on top of the player, swallowing
      // focus and pointer events.
      activeOverlay?.remove();
      activeOverlay = null;
      activeDialog = null;
    };

    const dialog = renderVideoErrorDialog(state, t, onRetry);
    activeDialog = dialog;

    // Wrap in an absolutely-positioned overlay container
    const overlay = document.createElement('div');
    overlay.className = 'error-dialog-container';
    overlay.appendChild(dialog);
    container.appendChild(overlay);
    activeOverlay = overlay;
    dialog.activate();
    // The overlay is the dimmed layer, so it is the node that has to go when the
    // dialog is dismissed. Removing only the dialog used to leave an empty full
    // screen layer on top of the player, swallowing focus and pointer events.
  };

  const onError = () => showError();

  videoEl.addEventListener('error', onError);
  const detachBuffering = attachVideoBufferingIndicator(videoEl, t);
  if (videoEl.error) showError();

  return () => {
    disposed = true;
    activeDialog?.cleanup();
    videoEl.removeEventListener('error', onError);
    detachBuffering();
    activeDialog?.remove();
    activeOverlay?.remove();
    activeDialog = null;
    activeOverlay = null;
  };
}
