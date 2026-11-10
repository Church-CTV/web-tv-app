/**
 * ErrorBoundary — catches render errors and shows a fallback screen with retry.
 * Prevents entire app crash from a single screen rendering error.
 */

import { renderErrorScreen, initErrorScreen, getErrorScreen } from './ErrorHandling';

export interface ErrorBoundaryProps {
  /** Screen name for analytics tracking */
  screenName: string;
  /** Child element or HTML string to render */
  children: HTMLElement | string;
  /** Retry function to call when error occurs */
  onRetry: () => void;
}

/**
 * Wrap content in an error boundary.
 * If the content is an HTMLElement, wraps it in a container div.
 * If it's a string, sets it as innerHTML of a container div.
 */
export function createErrorBoundary(props: ErrorBoundaryProps): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'error-boundary';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', `Content area — ${props.screenName}`);

  try {
    if (typeof props.children === 'string') {
      container.innerHTML = props.children;
    } else {
      container.appendChild(props.children);
    }
  } catch (error) {
    console.error(`[ErrorBoundary] Failed to render screen "${props.screenName}":`, error);
    const errData = getErrorScreen('generic');
    container.innerHTML = renderErrorScreen(errData, props.onRetry);
    initErrorScreen(props.onRetry);
  }

  return container;
}
