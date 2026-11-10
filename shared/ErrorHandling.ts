/**
 * Shared error handling utilities — platform-agnostic.
 */

import { errorIconSvg } from './ui/Icons';

export interface ErrorScreenData {
  title: string;
  message: string;
  icon: string;
  action?: string;
  retryable?: boolean;
  details?: string;
  type?: string;
}

export type ErrorType =
  'network' | 'feed' | 'ui' | 'stream' | 'video' | 'auth' | 'generic' | string;

export function getErrorScreen(
  type: 'network' | 'feed' | 'ui' | 'stream' | 'video' | 'auth' | 'generic' | string
): ErrorScreenData {
  const errors: Record<string, ErrorScreenData> = {
    network: {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your network connection.',
      icon: 'warning',
      action: 'Check Connection',
      retryable: true,
      type: 'network',
    },
    feed: {
      title: 'Content Error',
      message: 'Failed to load content. Please try again later.',
      icon: 'warning',
      action: 'Retry',
      retryable: true,
      type: 'feed',
    },
    ui: {
      title: 'Display Error',
      message:
        'This screen did not load. Check the network connection, then choose Go Back to try again.',
      icon: 'warning',
      action: 'Go Back',
      type: 'ui',
    },
    stream: {
      title: 'Playback Error',
      message: 'Unable to play this content. Please try another title.',
      icon: 'warning',
      action: 'Try Another',
      type: 'stream',
    },
    video: {
      title: 'Playback Error',
      message: 'Unable to play this content. Please try another title.',
      icon: 'warning',
      retryable: true,
      type: 'video',
    },
    auth: {
      title: 'Authentication Error',
      message:
        'This content is not available from your server. Check the server address in Settings, then try again.',
      icon: 'warning',
      type: 'auth',
    },
    generic: {
      title: 'Error',
      message: 'Something went wrong. Please try again.',
      icon: 'warning',
      retryable: true,
      type: 'generic',
    },
  };
  const known = errors[type] as ErrorScreenData | undefined;
  if (known) return known;
  // Unknown type: return a generic error screen
  return {
    title: 'Error',
    message: 'Something went wrong. Try again, or restart the app if it keeps happening.',
    icon: 'warning',
    retryable: true,
    type,
  };
}

export function renderErrorScreen(err: ErrorScreenData, onRetry?: () => void): string {
  const btnHtml =
    onRetry || err.retryable
      ? `<button id="error-retry" class="error-screen__btn btn-retry button-primary">${err.action || 'Try Again'}</button>`
      : '';
  return `<div class="error-screen" role="alert">
    <div class="error-screen__icon" aria-hidden="true">${errorIconSvg(err.icon)}</div>
    <h2 class="error-screen__title">${err.title}</h2>
    <p class="error-screen__message">${err.message}</p>
    ${err.details ? `<p class="error-screen__details">${escapeHtml(err.details)}</p>` : ''}
    ${btnHtml}
  </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initErrorScreen(onRetry: () => void): void {
  const btn = document.getElementById('error-retry');
  if (btn) btn.addEventListener('click', onRetry);
}

/**
 * Wrap a function with error boundary — catches exceptions and calls onError.
 */
export function withErrorBoundary<T>(
  fn: () => T,
  onError: (error: Error) => void
): () => T | undefined {
  return (): T | undefined => {
    try {
      return fn();
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
      return undefined;
    }
  };
}

/**
 * Handle video player errors — reports only when player is in an error state.
 */
export function handleVideoError(
  player: { getState: () => string },
  onError: (error: ErrorScreenData) => void
): void {
  const state = player.getState();
  if (state === 'error') {
    onError(getErrorScreen('video'));
  }
  // Do not report for playing, idle, or paused states
}

/**
 * Handle feed parsing errors — always reports since feed errors need attention.
 */
export function handleFeedError(error: unknown, onError: (error: ErrorScreenData) => void): void {
  const message = error instanceof Error ? error.message : String(error);
  const feedError = getErrorScreen('feed');
  feedError.details = message;
  onError(feedError);
}
