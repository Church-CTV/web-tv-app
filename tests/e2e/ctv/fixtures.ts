/**
 * Shared fixtures for CTV production-preview E2E (Tizen + Vizio + webOS).
 *
 * These tests run against `vite preview` (real production bundles) at 1920x1080.
 * The app fetches `/feed`, `/api/analytics`, etc. from the preview origin.
 * In test/CI there is no backend, so we intercept those requests with
 * deterministic fixtures. Static assets (JS/CSS/HTML) are served untouched.
 */

import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed.json');
// The channel profile the client asks the server for (GET /api/v2/config).
// Intercepted because the client's server base URL is the live channel host:
// unmocked, the browser suites would read a real church's channel name and
// feature switches from production, and the request is CORS-blocked anyway.
const FIXTURE_CLIENT_CONFIG = path.join(
  REPO_ROOT,
  'shared',
  'test-fixtures',
  'mock-client-config.json'
);
const STREAM_MP4 = path.join(REPO_ROOT, 'tests', 'e2e', 'assets', 'test-stream.mp4');

interface MockRoute {
  pattern: RegExp;
  body: () => unknown;
  status?: number;
}

const MOCK_RESPONSES: MockRoute[] = [
  {
    pattern: /\/feed\/?$/,
    body: () => JSON.parse(fs.readFileSync(FIXTURE_FEED, 'utf-8')),
  },
  {
    pattern: /\/api\/v2\/config$/,
    body: () => JSON.parse(fs.readFileSync(FIXTURE_CLIENT_CONFIG, 'utf-8')),
  },
  { pattern: /\/schedule\/?$/, body: () => [] },
  { pattern: /\/api\/analytics$/, body: () => ({ ok: true }) },
  { pattern: /\/api\/heartbeat$/, body: () => ({ ok: true }) },
];

/**
 * Build @font-face CSS that pins the app font to the embedded test fonts.
 * Injected via page.addInitScript (no HTML interception — intercepting
 * the document HTML would break Vite preview on "/").
 */
function e2eFontCSS(): string {
  const face = (weight: string, file: string) =>
    `@font-face{font-family:RobotoTest;font-style:normal;font-weight:${weight};` +
    `font-display:swap;src:url(/__e2e_font__/${file}) format('woff2');}`;
  return (
    face('400', 'Roboto-Regular.woff2') +
    face('500', 'Roboto-Regular.woff2') +
    face('700', 'Roboto-Bold.woff2') +
    ':root{--font-family:RobotoTest,Roboto,sans-serif !important;}'
  );
}

/**
 * Register route interception for hermetic backend and font pinning.
 */
export async function mockAppRoutes(page: Page): Promise<void> {
  // Pin fonts for deterministic screenshots.
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.setAttribute('data-e2e', 'font-pin');
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, e2eFontCSS());

  const FONT_DIR = path.join(REPO_ROOT, 'tests', 'e2e', 'assets', 'fonts');

  await page.route('**/*', async (route) => {
    const url = route.request().url();

    // Serve embedded test fonts.
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

    if (/\/stream\/.*\.mp4$/.test(url)) {
      const mp4 = fs.readFileSync(STREAM_MP4);
      await route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: mp4,
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Make the /feed route fail (503) so the app shows its network-error path.
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

/**
 * Make the /feed route fail for the first `n` requests, then succeed.
 * Used to test retry recovery.
 */
export async function failFeedTimes(page: Page, n: number, status = 503): Promise<void> {
  let count = 0;
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => {
    count++;
    if (count <= n) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated network failure' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(JSON.parse(fs.readFileSync(FIXTURE_FEED, 'utf-8'))),
    });
  });
}

/**
 * Make the /feed route abort at the network level (offline / DNS failure).
 * All HttpClient retries fail immediately.
 */
export async function abortFeed(page: Page): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => route.abort('internetdisconnected'));
}

/**
 * Make the /feed route abort for the first `n` requests, then succeed.
 * Simulates offline startup where the retry button (n+1th attempt) recovers.
 */
export async function abortFeedTimes(page: Page, n: number): Promise<void> {
  let count = 0;
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => {
    count++;
    if (count <= n) {
      return route.abort('internetdisconnected');
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(JSON.parse(fs.readFileSync(FIXTURE_FEED, 'utf-8'))),
    });
  });
}

/**
 * Serve a malformed JSON response for /feed (HTTP 200 but broken JSON body).
 * Simulates a backend returning corrupted data.
 */
export async function malformedFeed(page: Page): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"feed": [invalid json here...',
    })
  );
}

/**
 * Serve a partial/truncated JSON response for /feed.
 * Simulates a partial response where the JSON body is cut off mid-stream.
 */
export async function partialFeed(page: Page): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"feed": [{"id": "1", "title": "Test", "thumbnail": "test.jpg", "pro',
    })
  );
}

/**
 * Wait for the app to be ready: content grid visible, loading screen gone.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator('#content-grid').waitFor({ state: 'visible', timeout: 15000 });
  await page
    .locator('#screen-loading')
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {});
  await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(200);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockAppRoutes(page);
    await use(page);
  },
});

export { expect };
