/**
 * SplashScreen — Launch splash screen matching Roku SceneGraph pattern.
 * Renders splash screen with configurable color, text, and minimum duration.
 * Supports SD (1280x720), HD (1920x1080), FHD (1920x1080) resolution variants.
 */

import { escapeHtml } from '../utils/HtmlEscape';

export interface SplashScreenConfig {
  /** Channel/app title displayed on splash */
  title: string;
  /** Subtitle displayed below title */
  subtitle?: string;
  /** Splash background color (hex, e.g. '#808080') — mirrors Roku splash_color */
  splashColor?: string;
  /** Minimum display duration in milliseconds — mirrors Roku splash_min_time */
  minDisplayMs?: number;
  /** Logo URL (optional, mirrors Roku mm_icon_focus) */
  logoUrl?: string;
  /** Resolution hint: 'sd' | 'hd' | 'fhd' */
  resolution?: 'sd' | 'hd' | 'fhd';
}

export interface SplashScreenCallbacks {
  /** Called when splash should be dismissed */
  onDismiss?: () => void;
}

/**
 * Render the splash screen as an HTML string.
 * Mirrors Roku's splash screen with splash_color background and channel title.
 */
export function renderSplashScreen(config: SplashScreenConfig): string {
  const { title, subtitle = '', splashColor = '#000000', logoUrl, resolution = 'fhd' } = config;

  let logoHtml = '';
  if (logoUrl) {
    logoHtml = `<img class="splash-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(title)}" />`;
  }

  let subtitleHtml = '';
  if (subtitle) {
    subtitleHtml = `<div class="splash-subtitle">${escapeHtml(subtitle)}</div>`;
  }

  return `<div class="splash-screen" id="splash-screen" style="background-color:${splashColor}" data-resolution="${resolution}" role="alert" aria-live="polite" aria-label="Loading ${escapeHtml(title)}">
    <div class="splash-container">
      ${logoHtml}
      <h1 class="splash-title">${escapeHtml(title)}</h1>
      ${subtitleHtml}
    </div>
  </div>`;
}

/**
 * Initialize splash screen — append to DOM and auto-dismiss after minimum duration.
 * Returns a promise that resolves when splash is dismissed, or a function to dismiss immediately.
 */
export function initSplashScreen(
  config: SplashScreenConfig,
  callbacks: SplashScreenCallbacks = {}
): { dismiss: () => void; promise: Promise<void> } {
  const { onDismiss } = callbacks;
  const { minDisplayMs = 1000 } = config;

  const body = document.body;
  const splashEl = document.createElement('div');
  splashEl.innerHTML = renderSplashScreen(config);
  const wrapper = splashEl.firstElementChild as HTMLElement;
  wrapper.id = 'splash-screen';
  wrapper.style.position = 'absolute';
  wrapper.style.top = '0';
  wrapper.style.left = '0';
  wrapper.style.width = '100vw';
  wrapper.style.height = '100vh';
  wrapper.style.zIndex = '9999';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.opacity = '0';
  wrapper.style.transition = 'opacity 300ms ease';
  body.insertBefore(wrapper, body.firstChild);

  // Fade in
  requestAnimationFrame(() => {
    wrapper.style.opacity = '1';
  });

  // Track when the splash was inserted so that `dismiss()` can honour
  // the minimum display duration even if the app finishes loading early.
  const startTime = Date.now();

  let dismissed = false;
  let resolvePromise: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  /**
   * Execute the fade-out → remove → resolve sequence.
   */
  function doDismiss(): void {
    wrapper.style.opacity = '0';
    setTimeout(() => {
      wrapper.remove();
      onDismiss?.();
      resolvePromise();
    }, 300);
  }

  /**
   * Public dismiss: guarantees at least `minDisplayMs` of visibility,
   * even if called early (before the minimum has elapsed).
   */
  function dismiss(): void {
    if (dismissed) return;
    dismissed = true;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, minDisplayMs - elapsed);
    setTimeout(doDismiss, remaining);
  }

  // Auto-dismiss after the minimum duration if the caller never called
  // `dismiss()` explicitly.
  setTimeout(() => {
    if (!dismissed) {
      dismissed = true;
      doDismiss();
    }
  }, minDisplayMs);

  return { dismiss, promise };
}
