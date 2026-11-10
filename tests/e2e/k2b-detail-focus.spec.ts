/**
 * K2b — Direct-play focus + grid focus restoration tests.
 *
 * Selection opens full-screen playback directly with no intermediate detail
 * screen (user directive 2026-09-22). These tests cover:
 *  - Video screen: focus lands on the progress bar when playback opens directly
 *  - Video screen: D-pad keys on the video screen don't leak to hidden grid/nav
 *  - Grid: when returning to the grid from any secondary screen, a card has focus
 */

import { test, expect, waitForAppReady } from './fixtures';

/**
 * Open a video directly from a grid card (no detail screen in between).
 */
async function openVideoDirectly(page: any) {
  await page.goto('/');
  await waitForAppReady(page);

  const firstCard = page.locator('.content-card').first();
  await firstCard.click();

  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#video-player')).toBeVisible();
}

test('K2b: Progress bar has focus when the video screen opens directly', async ({ page }) => {
  await openVideoDirectly(page);

  // Direct play moves focus onto the video screen's progress bar.
  const progress = page.locator('.video-screen__progress');
  await expect(progress).toBeVisible();
  // Focus settles asynchronously after direct-play opens. Poll until it lands
  // instead of a single-shot evaluate that can read document.activeElement
  // mid-transition (flaky under parallel-suite load).
  await page.waitForFunction(
    () => {
      const a = document.activeElement as HTMLElement | null;
      if (!a) return false;
      return a.classList.contains('video-screen__progress') || a.closest('.video-screen') !== null;
    },
    undefined,
    { timeout: 5000 }
  );
});

test('K2b: D-pad Down on the video screen does not focus hidden grid elements', async ({
  page,
}) => {
  await openVideoDirectly(page);

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);

  const activeClassName = await page.evaluate(
    () => (document.activeElement as HTMLElement)?.className || ''
  );
  expect(!activeClassName.includes('content-card')).toBeTruthy();
});

test('K2b: D-pad Up on the video screen does not focus hidden nav items', async ({ page }) => {
  await openVideoDirectly(page);

  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);

  const activeClassName = await page.evaluate(
    () => (document.activeElement as HTMLElement)?.className || ''
  );
  expect(!activeClassName.includes('left-nav__item')).toBeTruthy();
});

test('K2b: Returning to grid from search screen, a card has focus', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const searchLink = page.locator('.left-nav__item:has-text("Search")');
  await searchLink.click();
  await expect(page.locator('.search-screen')).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible();

  await page.waitForFunction(
    () => {
      const active = document.activeElement;
      return active !== null && (active as HTMLElement).classList.contains('content-card');
    },
    { timeout: 5000 }
  );
});

test('K2b: Returning to grid from settings screen, a card has focus', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const settingsLink = page.locator('.left-nav__item:has-text("Settings")');
  await settingsLink.click();
  await expect(page.locator('.settings-screen')).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible();

  await page.waitForFunction(
    () => {
      const active = document.activeElement;
      return active !== null && (active as HTMLElement).classList.contains('content-card');
    },
    { timeout: 5000 }
  );
});

test('K2b: Returning to grid from video, a card has focus', async ({ page }) => {
  await openVideoDirectly(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible();

  await page.waitForFunction(
    () => {
      const active = document.activeElement;
      return active !== null && (active as HTMLElement).classList.contains('content-card');
    },
    { timeout: 5000 }
  );
});
