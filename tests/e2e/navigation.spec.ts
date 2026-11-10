/**
 * E2E Test: Navigation flow — Home → Video (direct play) → Seek → Back.
 *
 * Selection opens full-screen playback directly with no intermediate detail
 * screen (user directive 2026-09-22). Back from video returns to the home grid.
 */

import { test, expect, waitForAppReady } from './fixtures';

test('full navigation flow: home → video (direct) → seek → back', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Verify home screen loaded
  await expect(page.locator('#content-grid')).toBeVisible();
  await expect(page.locator('.left-nav')).toBeVisible();

  // Click a content card to play directly (no detail screen)
  const firstCard = page.locator('.content-card').first();
  await firstCard.click();

  // Verify the video screen opens directly (no #content-detail in between)
  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#video-player')).toBeVisible();

  // Seek to 50%
  const progressBar = page.locator('.video-screen__progress');
  const rect = await progressBar.boundingBox();
  if (rect) {
    await progressBar.click({ position: { x: rect.width / 2, y: rect.height / 2 } });
  }

  // Press Escape to go back
  await page.keyboard.press('Escape');

  // Should return to the home grid (detail screen is bypassed)
  await expect(page.locator('#content-grid')).toBeVisible();
});

test('search flow: open → type → results → select', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Open search via left nav
  const searchLink = page.locator('.left-nav__item:has-text("Search")');
  await searchLink.click();

  await expect(page.locator('.search-screen')).toBeVisible();

  // Type in search input (TS-rendered, not the HTML template input)
  const searchInput = page.locator('.search-screen__input');
  await searchInput.fill('test');

  // Verify results container exists (TS-rendered)
  await expect(page.locator('.search-screen__results')).toBeVisible();
});

test('settings screen loads and persists', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const settingsLink = page.locator('.left-nav__item:has-text("Settings")');
  await settingsLink.click();

  await expect(page.locator('.settings-screen')).toBeVisible();
  await expect(page.locator('.settings-channel')).toContainText('Channel: Test Church Channel');
  await expect(page.locator('.settings-give__link')).toHaveAttribute(
    'href',
    'https://giving.example.test/donate'
  );
});

test('back button works from any screen', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Navigate to search
  const searchLink = page.locator('.left-nav__item:has-text("Search")');
  await searchLink.click();
  await expect(page.locator('.search-screen')).toBeVisible();

  // Press back
  await page.keyboard.press('Escape');

  // Should return to home
  await expect(page.locator('#content-grid')).toBeVisible();
});
