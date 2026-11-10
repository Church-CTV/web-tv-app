/**
 * E2E Test: Search flow — open search → type query → select result
 */

import { test, expect, waitForAppReady } from './fixtures';

test('search flow: open search → type → select', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Open search via left nav
  const searchLink = page.locator('.left-nav__item:has-text("Search")');
  await searchLink.click();

  // Verify search screen is shown
  await expect(page.locator('.search-screen')).toBeVisible();

  // Type in search input
  const searchInput = page.locator('input[type="text"], .search-screen__input');
  await searchInput.fill('test');

  // Select first result — plays directly (no detail screen)
  const firstResult = page.locator('.search-results .content-card').first();
  if (await firstResult.isVisible()) {
    await firstResult.click();
    await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  }
});
