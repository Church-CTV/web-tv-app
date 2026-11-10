/**
 * E2E Smoke Tests: Tizen production preview (vite preview @ 1920x1080).
 *
 * Scope (D6): navigation + error-recovery + a11y smoke. Not a full 62-spec
 * clone; this proves the Tizen production bundle boots and is usable.
 */

import { test, expect, waitForAppReady, failFeedTimes } from './fixtures';
import { defineJ2cTests } from './j2c.helper';

test('home screen renders content grid and left nav', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Main content grid is populated from the feed.
  await expect(page.locator('#content-grid')).toBeVisible();
  await expect(page.locator('#content-grid .content-card').first()).toBeVisible();

  // Left nav rendered with the HD 3-item rail (home, search, settings) —
  // 96a7cad trimmed the Roku HD leftnav; the other screens are no longer
  // navigable from Tizen and have no nav baselines.
  await expect(page.locator('#left-nav')).toBeVisible();
  const navItems = page.locator('.left-nav__item');
  await expect(navItems).toHaveCount(3);
});

test('search screen loads and filters results', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await page.locator('.left-nav__item:has-text("Search")').click();
  await expect(page.locator('.search-screen')).toBeVisible();

  // HD search uses an on-screen keyboard (the real input is hidden). Type
  // "sermon" via the OSK; it should filter to the matching feed entries.
  for (const k of ['s', 'e', 'r', 'm', 'o', 'n']) {
    await page.locator(`.osk-key[data-key="${k}"]`).click();
  }
  await expect(page.locator('.search-screen__results [role="button"]').first()).toBeVisible({
    timeout: 5000,
  });
});

test('settings screen shows channel information and the approved giving destination', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppReady(page);

  await page.locator('.left-nav__item:has-text("Settings")').click();
  await expect(page.locator('.settings-screen')).toBeVisible();
  await expect(page.locator('.settings-channel')).toContainText('Channel:');
  await expect(page.locator('.settings-give__link')).toHaveAttribute(
    'href',
    'https://giving.example.test/donate'
  );
  await expect(page.locator('[data-setting]')).toHaveCount(0);
});

test('video screen loads when selecting a card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const firstCard = page.locator('#content-grid .content-card').first();
  await firstCard.click();
  await expect(page.locator('#screen-video')).toBeVisible();
  await expect(page.locator('#video-player')).toBeVisible();
});

test('error screen shows on feed failure and retry recovers', async ({ page }) => {
  // HttpClient retries up to 3 times with exponential backoff — fail all 3
  // attempts so the error screen renders. The 4th attempt (retry click)
  // succeeds because count > n.
  await failFeedTimes(page, 3, 503);
  await page.goto('/');

  // App shows its error state (the #error-retry button in the static HTML shell
  // is reused via the catch handler's initErrorScreen path on Tizen).
  const retryBtn = page.locator('#error-retry').or(page.locator('#retry-btn'));
  await expect(retryBtn).toBeVisible({ timeout: 10000 });

  // Click retry -> feed succeeds -> grid recovers.
  await retryBtn.click();
  await expect(page.locator('#content-grid .content-card').first()).toBeVisible({ timeout: 15000 });
});

test('a11y: document has lang, title, main landmark, and no visible console errors', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await waitForAppReady(page);

  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang).toBeTruthy();
  expect(lang).toMatch(/^[a-z]{2,3}/);

  const title = await page.title();
  expect(title).toBeTruthy();

  const hasMain = await page.evaluate(
    () => !!(document.querySelector('main') || document.querySelector('[role="main"]'))
  );
  expect(hasMain).toBe(true);

  // Ignore benign console noise (favicon, etc.); only fail on real app errors.
  const realErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('ResizeObserver')
  );
  expect(realErrors, `unexpected console errors: ${realErrors.join('\n')}`).toHaveLength(0);
});

// ─── J2c: Offline startup and recovery matrix ────────────────────────────

defineJ2cTests({ errorScreen: '.error-screen', retryBtn: '#error-retry' });
