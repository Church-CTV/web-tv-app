/**
 * E2E Test: Error recovery — real network failure, error screen, retry, and
 * splash lifecycle. Every assertion here exercises the app's actual code paths
 * (feed 503 → error screen → retry → recovery).
 */

import { test, expect, waitForAppReady, failFeedTimes, navigateToVideoScreen } from './fixtures';

test('error screen shows on feed load failure', async ({ page }) => {
  // Fail all 3 feed attempts (HttpClient does 3 max attempts by default).
  await failFeedTimes(page, 3, 503);
  await page.goto('/');

  // The app must render its connection error screen.
  await expect(page.locator('#error-screen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#error-screen .error-screen__title')).toHaveText('Connection Error');
  await expect(page.locator('#error-screen .error-screen__message')).toContainText(
    'Unable to connect'
  );
});

test('error screen renders with role="alert" for screen reader announcements (WCAG 4.1.3)', async ({
  page,
}) => {
  // Fail all 3 feed attempts (HttpClient does 3 max attempts by default).
  // The real rendered HTML must carry role="alert" — screen readers announce it.
  await failFeedTimes(page, 3, 503);
  await page.goto('/');

  await expect(page.locator('#error-screen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#error-screen')).toHaveAttribute('role', 'alert');
});

test('retry button recovers from error screen', async ({ page }) => {
  // Fail all 3 feed attempts (HttpClient does 3 max attempts by default).
  // After the error screen, the retry button triggers a 4th (recovery) request.
  await failFeedTimes(page, 3, 503);
  await page.goto('/');

  // Error screen with retry button.
  const retryBtn = page.locator('#btn-retry');
  await expect(retryBtn).toBeVisible({ timeout: 10000 });
  await expect(retryBtn).toHaveText('Try Again');

  // Clicking retry must re-fetch the feed and restore the grid.
  await retryBtn.click();
  await expect(page.locator('#content-grid .content-card').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#error-screen')).toBeHidden({ timeout: 10000 });
});

test('splash screen displays on initial load', async ({ page }) => {
  // The splash has a 1000ms minimum display, so it must be catchable during
  // page load — the wait below IS the assertion.
  await page.goto('/');
  await page.locator('#splash-screen').waitFor({ state: 'attached', timeout: 5000 });
  // While the splash is up, it must carry the app title and live-region role.
  await expect(page.locator('#splash-screen')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#splash-screen .splash-title')).toHaveText('Chroma Channel');

  await waitForAppReady(page);
  // After the splash fades (300ms transition), it must be removed from DOM.
  await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 10000 });
});

test('splash screen transitions to main view', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Main view visible AND splash gone — both required.
  await expect(page.locator('#content-grid')).toBeVisible();
  await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 10000 });
});

test('video player renders with controls', async ({ page }) => {
  // Real playback flow: home → first card → play.
  await page.goto('/');
  await waitForAppReady(page);
  await navigateToVideoScreen(page);

  // The real player is present and drives playback via the CTV custom
  // controls overlay (native `controls` is intentionally removed).
  const video = page.locator('#video-player');
  await expect(video).toBeVisible();
  // Progress bar and time display render inside the custom controls overlay.
  await expect(page.locator('.video-screen__controls')).toBeVisible();
  await expect(page.locator('.video-screen__progress')).toBeVisible();
  await expect(page.locator('.video-screen__time')).toBeVisible();
});

test('responsive layout adapts to different viewport sizes', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Desktop: 1920x1080 (CTV standard).
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await expect(page.locator('#content-grid')).toBeVisible();
  const desktopCard = await page.locator('.content-card').first().boundingBox();
  expect(desktopCard).toBeTruthy();

  // Portrait: 720x1280 (mobile-style CTV).
  await page.setViewportSize({ width: 720, height: 1280 });
  await page.waitForTimeout(300);
  await expect(page.locator('#content-grid')).toBeVisible();
  const portraitCard = await page.locator('.content-card').first().boundingBox();
  expect(portraitCard).toBeTruthy();

  // Cards must actually reflow: widths must differ between orientations.
  expect(desktopCard!.width).not.toBeCloseTo(portraitCard!.width, 0);
});

test('keyboard navigation works', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Tab moves focus to a real, visible interactive element.
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const tag = await focused.evaluate((el) => el.tagName.toLowerCase());
  expect(['button', 'a', 'input', 'video', 'div', 'span', 'li', 'article'].includes(tag)).toBe(
    true
  );
});

test('all screen containers exist in DOM', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const screens = [
    '#screen-grid',
    '#screen-video',
    '#screen-search',
    '#screen-settings',
    '#screen-error',
  ];

  // Each container must exist exactly once in the DOM.
  for (const screen of screens) {
    const count = await page.locator(screen).count();
    expect(count, `container ${screen} must exist exactly once`).toBe(1);
  }
});
