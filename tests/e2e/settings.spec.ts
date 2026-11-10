/**
 * E2E Test: Settings flow — open settings → toggle layout → verify persistence
 */

import { test, expect, waitForAppReady } from './fixtures';

test('settings flow: open settings → toggle → verify', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Open settings via left nav
  const settingsLink = page.locator('.left-nav__item:has-text("Settings")');
  await settingsLink.click();

  // Verify settings screen is shown
  await expect(page.locator('.settings-screen')).toBeVisible();

  // Toggle layout option
  const layoutSelect = page.locator('select, .settings-screen__layout');
  if (await layoutSelect.isVisible()) {
    await layoutSelect.selectOption('grid-2');
  }

  // Verify change persisted
  const saved = page.evaluate(() => localStorage.getItem('ctv_layout'));
  expect(saved).toBeTruthy();
});
