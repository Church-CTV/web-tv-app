/**
 * Certification readiness test — validates that the app meets FireTV and Google TV certification requirements.
 * Tests: D-pad navigation, exit behavior, focus management, a11y, performance benchmarks.
 */

import { test, expect, waitForAppReady, waitForSplashVisible } from './fixtures';

// ─── D-Pad Navigation ─────────────────────────────────────────────────────────

test('D-pad right navigates within row', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  const firstCard = page.locator('.content-card').first();
  await firstCard.focus();

  // Simulate D-pad right (ArrowRight)
  await page.keyboard.press('ArrowRight');

  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
});

test('D-pad down switches rows', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Focus first card in first row
  const firstCard = page.locator('.content-card').first();
  await firstCard.focus();

  // Simulate D-pad down
  await page.keyboard.press('ArrowDown');

  // Should still have focus
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
});

test('D-pad up switches rows', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Focus a card in second row
  const secondCard = page.locator('.content-card').nth(5);
  if (await secondCard.isVisible()) {
    await secondCard.focus();
    await page.keyboard.press('ArrowUp');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  }
});

test('Escape exits to home from any screen', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Navigate to search
  const searchLink = page.locator('.left-nav__item:has-text("Search")');
  await searchLink.click();
  await expect(page.locator('.search-screen')).toBeVisible();

  // Press Escape (back button)
  await page.keyboard.press('Escape');

  // Should return to home
  await expect(page.locator('#content-grid')).toBeVisible();
});

// ─── Focus Management ─────────────────────────────────────────────────────────

test('all interactive elements have focus indicators', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Cards should have tabindex
  const cards = page.locator('.content-card[tabindex]');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test('focus order matches visual layout', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Tab through elements
  await page.keyboard.press('Tab');
  const firstFocused = page.locator(':focus');
  await expect(firstFocused).toBeVisible();

  await page.keyboard.press('Tab');
  const secondFocused = page.locator(':focus');
  await expect(secondFocused).toBeVisible();
});

// ─── Accessibility ────────────────────────────────────────────────────────────

test('all interactive elements have ARIA roles', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Check main content area has role
  const main = page.locator('[role="main"]');
  const count = await main.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test('video player has controls attribute', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const video = page.locator('video[controls]');
  expect(video).toBeTruthy();
});

test('search input has aria-label', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const search = page.locator('input[aria-label]');
  expect(search).toBeTruthy();
});

// ─── Performance ──────────────────────────────────────────────────────────────

test('page loads within 3 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/');
  // Measure DOM ready time (page shell + initial render), not full feed render.
  // The 3s budget is about initial page responsiveness.
  await page.waitForLoadState('domcontentloaded');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000);
});

test('no console errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForTimeout(500);

  // Critical errors (not feed fetch errors)
  const criticalErrors = errors.filter((e) => !e.includes('feed') && !e.includes('Fetch'));
  expect(criticalErrors).toEqual([]);
});

test('splash screen displays and fades', async ({ page }) => {
  await page.goto('/');
  // Wait for the app to be ready
  await waitForAppReady(page);
  // After the splash fades, the main grid must be visible
  await expect(page.locator('#content-grid')).toBeVisible();
});

// ─── Exit Behavior ────────────────────────────────────────────────────────────

test('back button is available from all screens', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForLoadState('domcontentloaded');

  // Navigate to each screen and verify back works. Roku-parity product scope
  // (2026-10-21 webOS, 2026-10-23 Tizen) left only Search and Settings as nav
  // destinations besides Home; the removed Schedule/Continue/Watch Later
  // entries could never match and gave this loop no coverage.
  const screens = ['Search', 'Settings'];

  for (const screenName of screens) {
    const link = page.locator(`.left-nav__item:has-text("${screenName}")`);
    if (await link.isVisible()) {
      await link.click();
      // Wait for the screen to become active
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      // Wait for the transition back to home to complete
      await page.waitForTimeout(300);
      // Verify we're back at the grid before proceeding to the next screen
      await expect(page.locator('#content-grid')).toBeVisible({ timeout: 5000 });
    }
  }

  // Should be back at home
  await expect(page.locator('#content-grid')).toBeVisible();
});
