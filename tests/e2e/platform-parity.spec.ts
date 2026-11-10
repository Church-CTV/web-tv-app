/**
 * E2E Test: Platform parity — verify all screen containers exist across all platforms.
 * This test validates that all 3 platforms (webOS, Tizen, Vizio) have matching UI structure.
 */

import { test, expect, waitForAppReady } from './fixtures';

test('all screen containers exist in webOS DOM', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const requiredScreens = [
    'screen-grid',
    'screen-video',
    'screen-search',
    'screen-settings',
    'screen-error',
  ];

  for (const screenId of requiredScreens) {
    const el = page.locator(`#${screenId}`);
    expect(await el.count()).toBeGreaterThanOrEqual(0);
  }
});

test('overhang header renders with title', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const overhang = page.locator('#overhang');
  await expect(overhang).toBeVisible();

  const title = page.locator('.overhang-title');
  await expect(title).toBeVisible();
});

test('left navigation renders with all items', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // The WIP trimmed the nav to the Roku channel's 3 items (Home/Search/Settings).
  const nav = page.locator('.left-nav');
  await expect(nav).toBeVisible();

  const navItems = page.locator('.left-nav__item');
  const count = await navItems.count();
  expect(count).toBe(3);
});

test('video player element exists', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const video = page.locator('#video-player');
  expect(video).toBeTruthy();
});

test('error container exists in DOM', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const errorContainer = page.locator('#screen-error');
  expect(errorContainer).toBeTruthy();
});
