/**
 * Content-Security-Policy helper + Vite plugin.
 *
 * Shared across the three platforms. The Vite plugin injects a CSP meta tag
 * into index.html during BUILD (production) only. Dev/serve mode is left
 * alone so Vite HMR keeps working.
 *
 * The LG webOSTV.js SDK is vendored locally under platforms/webos/vendor/,
 * so it is same-origin and covered by `script-src 'self'` (no CDN origin).
 */

export function getCspDirectives(_platform) {
  const base = [
    "default-src 'self'",
    "script-src 'self'",
    // NOTE: 'unsafe-inline' required for CSSOM writes (element.style.X = Y)
    // used throughout the app for video scrubbing, program guide, cards, etc.
    // TV CSPs commonly allow this; the app still blocks remote styles.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // NOTE: 'self' must be quoted. Chrome 149+ parses an unquoted bare token
    // as a literal host name instead of the special "self" keyword, which
    // silently blocks all same-origin XHR/fetch calls in the TV shells.
    // See scripts/csp-debug14.mjs for a repro.
    "connect-src 'self' https:",
    "media-src 'self' https: blob:",
    "img-src 'self' https: data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ];
  return base;
}

/**
 * Build the CSP meta tag for a given platform.
 *
 * @param {'webos' | 'tizen' | 'vizio'} platform
 * @returns {string}
 */
export function buildCspMetaTag(platform) {
  return `<meta http-equiv="Content-Security-Policy" content="${getCspDirectives(platform).join('; ')}">`;
}

/**
 * Build the Referrer-Policy meta tag (same across all platforms).
 *
 * @returns {string}
 */
export function getReferrerPolicyMetaTag() {
  return '<meta name="referrer" content="no-referrer">';
}

/**
 * Inject the CSP meta tag into an HTML string (idempotent).
 *
 * @param {string} html
 * @param {'webos' | 'tizen' | 'vizio'} platform
 * @returns {string}
 */
export function injectCsp(html, platform) {
  if (html.includes('Content-Security-Policy')) return html;
  const tag = `${buildCspMetaTag(platform)}\n  ${getReferrerPolicyMetaTag()}`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${tag}\n</head>`);
  }
  return html;
}

/**
 * Create a Vite plugin that injects the CSP meta tag at build time.
 *
 * Uses `apply: 'build'` so it is skipped in dev/serve mode (keeps Vite HMR
 * working for tests/E2E that boot the dev server).
 *
 * @param {'webos' | 'tizen' | 'vizio'} platform
 * @returns {import('vite').Plugin}
 */
export function cspPlugin(platform) {
  return {
    name: `ctv-csp-${platform}`,
    enforce: 'post',
    // Vite only calls this hook during `vite build` (apply: 'build'), never in
    // dev/serve. The command check is a defensive second guard.
    apply: 'build',
    transformIndexHtml(html, options) {
      if (options && options.command && options.command !== 'build') return html;
      return injectCsp(html, platform);
    },
  };
}
