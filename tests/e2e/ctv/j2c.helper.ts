/**
 * J2c shared E2E test factory — offline startup & recovery matrix.
 *
 * Shared across webOS/Tizen/Vizio CTV production-preview specs. Each platform
 * passes its own error-screen selectors since the DOM structure differs:
 * - webOS: dynamic .error-screen with #btn-retry (plus a static #error-retry)
 * - Tizen/Vizio: shared ErrorHandling → #error-retry
 *
 * Usage:
 *   import { defineJ2cTests } from './j2c.helper';
 *   defineJ2cTests({ errorScreen: '.error-screen', retryBtn: '#btn-retry' });
 */

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { abortFeed, abortFeedTimes, malformedFeed, partialFeed } from './fixtures';

export interface J2cConfig {
  /** CSS selector for the error screen container. */
  errorScreen: string;
  /** CSS selector for the retry button inside the error screen. */
  retryBtn: string;
}

export function defineJ2cTests({ errorScreen, retryBtn }: J2cConfig): void {
  // Wait for any error screen to become visible after retries are exhausted.
  const expectError = async (page: Page) => {
    const es = page.locator(errorScreen);
    await expect(es).toBeVisible({ timeout: 15000 });
    return es;
  };

  // No infinite spinner: the loading screen must be deactivated.
  // .screen uses opacity:0 (not display:none) when inactive, so Playwright's
  // toBeHidden still sees it. Assert the screen-active class is removed instead.
  const expectNoSpinner = async (page: Page) => {
    await page.waitForFunction(() => !document.querySelector('#screen-loading.screen-active'), {
      timeout: 5000,
    });
  };

  test('J2c offline startup - all retries exhausted shows offline error screen', async ({
    page,
  }) => {
    await abortFeed(page);
    await page.goto('/');
    const es = await expectError(page);
    await expect(es).toContainText(/connection|offline|network|internet|error/i);
    await expect(page.locator('#content-grid .content-card')).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test('J2c offline startup - retry button recovers when network comes back', async ({ page }) => {
    // First 3 attempts (HttpClient retries) fail; 4th (retry click) succeeds.
    await abortFeedTimes(page, 3);
    await page.goto('/');
    await expectError(page);
    const btn = page.locator(retryBtn).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await expect(page.locator('#content-grid .content-card').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(errorScreen)).toBeHidden({ timeout: 10000 });
  });

  test('J2c DNS failure - network error screen renders (not infinite spinner)', async ({
    page,
  }) => {
    // Simulate DNS resolution failure: Playwright abort code 'namenotresolved'
    // → Chromium surfaces a TypeError from fetch → HttpClient classifies 'network'.
    // (Note: 'dnserror' / 'net::ERR_NAME_NOT_RESOLVED' are NOT valid abort codes.)
    await page.route(/\/feed\/?(?:\?|#|$)/, (route) => route.abort('namenotresolved'));
    await page.goto('/');
    const es = await expectError(page);
    await expect(es).toContainText(/error|connection|offline|network|internet/i);
    await expectNoSpinner(page);
  });

  test('J2c request timeout - network error screen renders (not infinite spinner)', async ({
    page,
  }) => {
    // Simulate a request timeout: Playwright abort code 'timedout'.
    // HttpClient classifies this as code='network' (same as offline) so the
    // platform renders the generic network/connection error screen.
    await page.route(/\/feed\/?(?:\?|#|$)/, (route) => route.abort('timedout'));
    await page.goto('/');
    const es = await expectError(page);
    await expect(es).toContainText(/error|connection|offline|network|internet/i);
    await expectNoSpinner(page);
  });

  test('J2c malformed feed - error screen renders (not infinite spinner)', async ({ page }) => {
    await malformedFeed(page);
    await page.goto('/');
    await expectError(page);
    await expect(page.locator('#content-grid .content-card')).toHaveCount(0, {
      timeout: 5000,
    });
    await expectNoSpinner(page);
  });

  test('J2c partial feed response - error screen renders (not infinite spinner)', async ({
    page,
  }) => {
    await partialFeed(page);
    await page.goto('/');
    await expectError(page);
    await expect(page.locator('#content-grid .content-card')).toHaveCount(0, {
      timeout: 5000,
    });
    await expectNoSpinner(page);
  });
}
