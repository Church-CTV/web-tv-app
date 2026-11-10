/**
 * Shared E2E fixtures — hermetic feed mocking via Playwright route interception.
 *
 * The app fetches `/feed` from the dev-server origin. In test/CI there is no
 * backend, so we intercept the request and serve a deterministic fixture.
 * This makes the E2E suite hermetic (no real server needed) without changing
 * any production code.
 *
 * Usage in spec files:
 *   import { test, expect, waitForAppReady, navigateToScreen } from './fixtures';
 *
 * Every spec should call `await waitForAppReady(page);` after `page.goto('/')`
 * unless it is specifically testing the pre-ready (loading / error) state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed.json');
// The delivered channel profile (GET /api/v2/config). Mocking it is what keeps
// the browser suites deterministic: the client reads its channel name, feature
// switches and feed source from this document, so an unmocked config request
// would let production answer for the channel under test.
const FIXTURE_CLIENT_CONFIG = path.join(
  REPO_ROOT,
  'shared',
  'test-fixtures',
  'mock-client-config.json'
);
// Default media for most specs: the original tiny 2 s clip. Visual-regression
// baselines and the D-pad/navigation specs are stable against this exact file.
const STREAM_MP4 = path.join(REPO_ROOT, 'tests', 'e2e', 'assets', 'test-stream.mp4');
// Longer, deterministic 30 s clip used ONLY by the decision/qualification
// harness, which must prove real playback (frames advancing), a seek to the
// midpoint with time to play, and return. The 2 s clip ends almost
// immediately, racing those assertions. Bit-for-bit reproducible:
//   ffmpeg -f lavfi -i testsrc2=size=320x180:rate=15:duration=30 \
//     -f lavfi -i "aevalsrc=0.05*sin(440*2*PI*t):s=44100:d=30" \
//     -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p \
//     -c:a aac -b:a 64k -shortest <out>.mp4
export const QUALIFICATION_STREAM_MP4 = path.join(
  REPO_ROOT,
  'tests',
  'e2e',
  'assets',
  'test-stream-30s.mp4'
);
// Embedded test fonts: pinned font rendering makes visual-regression
// baselines deterministic across local machines and CI runners.
const FONT_DIR = path.join(REPO_ROOT, 'tests', 'e2e', 'assets', 'fonts');
const FONT_BASE_URL = '/__e2e_font__';

/**
 * Build the @font-face CSS that pins the app font to the embedded test
 * fonts. Injected via page.addInitScript (no HTML interception — intercepting
 * the document HTML would break Vite's HMR websocket on "/").
 */
function e2eFontCSS(): string {
  const face = (weight: string, file: string) =>
    `@font-face{font-family:RobotoTest;font-style:normal;font-weight:${weight};` +
    `font-display:swap;src:url(${FONT_BASE_URL}/${file}) format('woff2');}`;
  return (
    face('400', 'Roboto-Regular.woff2') +
    face('500', 'Roboto-Regular.woff2') +
    face('700', 'Roboto-Bold.woff2') +
    ':root{--font-family:RobotoTest,Roboto,sans-serif !important;}'
  );
}

interface MockRoute {
  pattern: RegExp;
  body: () => unknown;
  status?: number;
}

/**
 * Mock backend endpoints the app fetches. All intercepted — none hit the
 * network. Add new endpoints here as the app grows.
 */
const MOCK_RESPONSES: MockRoute[] = [
  // The home screen feed (primary data source).
  {
    pattern: /\/feed\/?$/,
    body: () => JSON.parse(fs.readFileSync(FIXTURE_FEED, 'utf-8')),
  },
  // The channel profile the client asks the server for at startup.
  {
    pattern: /\/api\/v2\/config$/,
    body: () => JSON.parse(fs.readFileSync(FIXTURE_CLIENT_CONFIG, 'utf-8')),
  },
  // Stub endpoints so they never throw if requested.
  { pattern: /\/schedule\/?$/, body: () => [] },
  { pattern: /\/api\/analytics$/, body: () => ({ ok: true }) },
  { pattern: /\/api\/heartbeat$/, body: () => ({ ok: true }) },
];

/**
 * Fulfill a media route honoring HTTP byte ranges. A full-body 200 makes
 * Chromium unable to random-seek a <video>; range support is required for
 * seek-to-midpoint / return journeys to work in the browser.
 */
export async function fulfillMediaRange(
  route: import('@playwright/test').Route,
  mp4: Buffer
): Promise<void> {
  const range = route.request().headers()['range'];
  const total = mp4.length;
  if (!range) {
    await route.fulfill({ status: 200, contentType: 'video/mp4', body: mp4 });
    return;
  }
  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) {
    // Non-standard range: fall back to the full body.
    await route.fulfill({ status: 200, contentType: 'video/mp4', body: mp4 });
    return;
  }
  const start = Math.max(0, parseInt(match[1], 10));
  const end = match[2] ? Math.min(total - 1, parseInt(match[2], 10)) : total - 1;
  await route.fulfill({
    status: 206,
    contentType: 'video/mp4',
    headers: {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
    },
    body: mp4.subarray(start, end + 1),
  });
}

/**
 * Register route interception on a page before any navigation.
 */
export async function mockAppRoutes(page: Page): Promise<void> {
  // Pin fonts for deterministic screenshots. addInitScript injects the
  // <style> into every document BEFORE the app CSS applies — no HTML or
  // websocket interception, so Vite HMR and console stay clean.
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.setAttribute('data-e2e', 'font-pin');
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, e2eFontCSS());

  await page.route('**/*', async (route) => {
    const url = route.request().url();

    // Serve the embedded test fonts from disk.
    const fontMatch = url.match(/__e2e_font__\/(Roboto-(Regular|Bold)\.woff2)$/);
    if (fontMatch) {
      return route.fulfill({
        status: 200,
        contentType: 'font/woff2',
        body: fs.readFileSync(path.join(FONT_DIR, fontMatch[1])),
      });
    }

    for (const mock of MOCK_RESPONSES) {
      if (mock.pattern.test(url)) {
        await route.fulfill({
          status: mock.status ?? 200,
          contentType: 'application/json',
          body: JSON.stringify(mock.body()),
        });
        return;
      }
    }

    // Stream URLs: serve a real MP4 so <video> loads without an error.
    // Byte ranges MUST be honored (206 Partial Content): a full-body 200
    // response makes Chromium unable to random-seek (seeking resets to the
    // start), which breaks every seek/return assertion in the E2E suite.
    if (/\/stream\/.*\.mp4$/.test(url)) {
      const mp4 = fs.readFileSync(STREAM_MP4);
      await fulfillMediaRange(route, mp4);
      return;
    }

    await route.continue();
  });
}

/**
 * Wait for the app to finish loading (feed loaded, grid shown, no loading/error screen).
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // The content grid being visible AND the screen-loading screen being hidden
  // together are the true "ready" signals.
  await page.locator('#content-grid').waitFor({ state: 'visible', timeout: 15000 });
  await page
    .locator('#screen-loading')
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {
      /* If screen-loading is already removed from DOM, this is fine */
    });

  // Give the app a moment to stabilize (focus, animations).
  await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(200);
}

/**
 * Wait for the splash screen to be visible during initial page load.
 * The splash is created dynamically and dismissed once the feed loads,
 * so it only appears briefly. Use this instead of checking for it
 * after waitForAppReady (which waits for the grid).
 *
 * Returns true if the splash was seen, false if it was already dismissed.
 */
export async function waitForSplashVisible(page: Page, timeoutMs = 3000): Promise<boolean> {
  // Try to catch the splash as it appears. The splash is rendered before
  // the grid, so it should be visible in the first moment of the page.
  try {
    await page.waitForSelector('#splash-screen', {
      state: 'attached',
      timeout: timeoutMs,
    });
    return true;
  } catch {
    // Splash was either never rendered or already removed before we could see it.
    return false;
  }
}

/**
 * Make the /feed route fail for the first `n` requests, then succeed with
 * the mock fixture feed.
 * Used to test the retry button: first load errors, retry load recovers.
 *
 * NOTE: after the failed requests we MUST fulfill directly with the fixture
 * feed. `route.continue()` would bypass the mockAppRoutes handler (Playwright
 * routes do not chain handlers), sending the request to the real (dead)
 * network instead.
 */
export async function failFeedTimes(page: Page, n: number, status = 503): Promise<void> {
  let count = 0;
  // Strict pattern: matches the feed fetch endpoint only, NOT Vite module
  // URLs like /@fs/.../feed/FeedParser.ts.
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => {
    count++;
    if (count <= n) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated network failure' }),
      });
    }
    // Recover: serve the real mock feed fixture.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(JSON.parse(fs.readFileSync(FIXTURE_FEED, 'utf-8'))),
    });
  });
}

/**
 * Wait for the page to fully settle: splash removed, transitions complete.
 * Use before screenshots or layout assertions.
 */
export async function waitForSettled(page: Page): Promise<void> {
  await page
    .locator('#splash-screen')
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {
      /* splash may already be gone */
    });
  // Allow fade transitions and focus-ring animations to finish.
  await page.waitForTimeout(400);
}

/**
 * Navigate to a screen by clicking its left-nav item. Returns true if the
 * target screen became visible, false if the nav item was not found.
 */
export async function navigateToScreen(page: Page, label: string): Promise<boolean> {
  const link = page.locator(`.left-nav__item:has-text("${label}")`);
  if ((await link.count()) === 0) return false;
  await link.click();
  const targets: Record<string, string> = {
    Search: '.search-screen',
    Schedule: '.schedule-screen',
    Settings: '.settings-screen',
    Continue: '.continue-watching-screen',
    'Watch Later': '.watch-later-screen',
  };
  const sel = targets[label];
  if (!sel) throw new Error(`navigateToScreen: unknown label "${label}"`);
  await expect(page.locator(sel).first()).toBeVisible({ timeout: 5000 });
  return true;
}

/**
 * Navigate to the video playback screen (home → first card → play).
 */
export async function navigateToVideoScreen(page: Page): Promise<void> {
  const firstCard = page.locator('.content-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });
  await firstCard.click();
  // Direct play: selection opens the video screen with no detail screen.
  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#video-player')).toBeVisible({ timeout: 5000 });
}

/**
 * Make the /feed route fail (503) so the app shows its network-error screen.
 * Call this before page.goto('/').
 */
export async function failFeed(page: Page, status = 503): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'simulated network failure' }),
    })
  );
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockAppRoutes(page);
    await use(page);
  },
});

export { expect };
