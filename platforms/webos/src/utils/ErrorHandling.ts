/**
 * ErrorHandler — centralized error handling for the app.
 * Catches errors, displays error screens, and optionally reports to analytics.
 */

import type { VideoPlayer } from '../Adapter/VideoPlayer';
import { errorIconSvg } from '@ctv/shared/ui/Icons';
import { escapeHtml } from './HtmlEscape';
import { getPlatformI18n } from './PlatformI18n';
import type { TranslationKey } from '@ctv/core/i18n/I18n';

export type ErrorType = 'network' | 'feed' | 'video' | 'auth' | 'generic';

export interface ErrorScreenData {
  type: ErrorType;
  title: string;
  message: string;
  retryable: boolean;
  details?: string;
}

const ERROR_KEYS: Record<ErrorType, { title: TranslationKey; message: TranslationKey }> = {
  network: {
    title: 'error.network.title',
    message: 'error.network.message',
  },
  feed: { title: 'error.feed.title', message: 'error.feed.message' },
  video: { title: 'error.video.title', message: 'error.video.message' },
  auth: { title: 'error.auth.title', message: 'error.auth.message' },
  generic: { title: 'error.generic.title', message: 'error.generic.message' },
};

/**
 * Get error screen data for an error type.
 */
export function getErrorScreen(type: ErrorType): ErrorScreenData {
  const i18n = getPlatformI18n();
  const keys = ERROR_KEYS[type] || ERROR_KEYS.generic;
  return {
    type,
    title: i18n.t(keys.title),
    message: i18n.t(keys.message),
    retryable: true,
  };
}

/**
 * Render the error screen HTML.
 */
export function renderErrorScreen(error: ErrorScreenData, onRetry?: () => void): string {
  const i18n = getPlatformI18n();
  let html = `
    <div class="error-screen" id="error-screen" role="alert">
      <div class="error-screen__icon" aria-hidden="true">${errorIconSvg()}</div>
      <h2 class="error-screen__title">${escapeHtml(error.title)}</h2>
      <p class="error-screen__message">${escapeHtml(error.message)}</p>
  `;

  if (error.details) {
    html += `<pre class="error-screen__details">${escapeHtml(error.details)}</pre>`;
  }

  if (error.retryable && onRetry) {
    html += `<button class="error-screen__btn" id="btn-retry" tabindex="0">${escapeHtml(i18n.t('try_again'))}</button>`;
  }

  html += '</div>';
  return html;
}

/**
 * Initialize the error screen button handlers.
 */
export function initErrorScreen(onRetry?: () => void): void {
  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn && onRetry) {
    retryBtn.addEventListener('click', onRetry);
  }
}

export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Create an error boundary handler.
 * Wraps a function and catches errors, calling onError on failure.
 * Non-Error exceptions are coerced to Error instances before being passed to onError.
 * The wrapped function returns undefined when an error occurs.
 *
 * @param fn - The function to wrap with error handling
 * @param onError - Callback invoked with the caught error
 * @returns The original function with error handling applied
 */
export function withErrorBoundary<T extends AnyFunction>(
  fn: T,
  onError: (error: Error) => void
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError(error);
      return undefined;
    }
  }) as unknown as T;
}

/**
 * Handle a video playback error.
 * Checks the player's current state and reports a video error screen
 * if the player is in the 'error' state.
 *
 * @param player - The video player instance to check
 * @param onError - Callback invoked with video error screen data
 */
export function handleVideoError(
  player: VideoPlayer,
  onError: (error: ErrorScreenData) => void
): void {
  const state = player.getState();
  if (state === 'error') {
    onError(getErrorScreen('video'));
  }
}

/**
 * Handle a feed loading error.
 * Reports a generic feed error screen to the error handler.
 * The error parameter is logged but not passed to onError —
 * the handler receives a user-friendly feed error regardless of the specific error.
 *
 * @param error - The error that occurred (logged to console.error)
 * @param onError - Callback invoked with feed error screen data
 */
export function handleFeedError(error: unknown, onError: (error: ErrorScreenData) => void): void {
  console.error('[ErrorHandling] Feed load failed:', error);
  onError(getErrorScreen('feed'));
}
