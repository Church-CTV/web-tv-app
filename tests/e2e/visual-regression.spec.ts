/**
 * Visual regression test — navigate to each screen, then compare the capture
 * against committed baselines with Playwright's built-in pixel diff.
 *
 * - Baselines live in tests/e2e/baseline/<name>.png and are committed.
 * - A run on a machine without baselines (fresh CI runner) auto-creates them
 *   (Playwright "missing screenshot" pass), so they are generated in CI.
 * - Subsequent runs diff and fail on real drift (tolerance via maxDiffPixels).
 * - Animated/time-varying regions (overhang clock, video timecode) are masked.
 *
 * Run: npx playwright test tests/e2e/visual-regression.spec.ts
 * Update baselines locally: npx playwright test --update-snapshots
 */

import {
  test,
  expect,
  waitForAppReady,
  waitForSettled,
  navigateToScreen,
  navigateToVideoScreen,
  failFeed,
} from './fixtures';
import type { Page, Locator } from '@playwright/test';

interface ScreenSpec {
  name: string;
  /** Navigate the app to this screen state. */
  go: (page: Page) => Promise<void>;
  /** Dynamic regions excluded from the diff (moving digits, animating parts). */
  mask?: (page: Page) => Locator[];
}

const SCREENS: ScreenSpec[] = [
  {
    name: 'home',
    go: async (page) => {
      await page.goto('/');
      await waitForAppReady(page);
      await waitForSettled(page);
    },
    // The overhang clock renders wall time, so it diffs on every run at a new
    // minute. Masked like the video timecode below, otherwise the gate absorbs
    // clock drift into its pixel budget instead of failing on real layout drift.
    mask: (page) => [page.locator('#overhang-clock')],
  },
  {
    name: 'video-player',
    go: async (page) => {
      await page.goto('/');
      await waitForAppReady(page);
      await navigateToVideoScreen(page);
      await page.waitForTimeout(500); // let the tiny test-stream decode a frame
      await waitForSettled(page);
    },
    mask: (page) => [
      // The timecode / clock display updates while the (tiny) test stream plays.
      page.locator('#screen-video .video-screen__time'),
      page.locator('#screen-video .video-screen__progress'),
    ],
  },
  {
    name: 'search',
    go: async (page) => {
      await page.goto('/');
      await waitForAppReady(page);
      await navigateToScreen(page, 'Search');
      await waitForSettled(page);
    },
  },
  {
    name: 'settings',
    go: async (page) => {
      await page.goto('/');
      await waitForAppReady(page);
      await navigateToScreen(page, 'Settings');
      await waitForSettled(page);
    },
  },
  {
    name: 'error',
    go: async (page) => {
      await failFeed(page);
      await page.goto('/');
      await expect(page.locator('.error-screen')).toBeVisible({ timeout: 20000 });
      await page.locator('#splash-screen').waitFor({ state: 'detached' });
      await waitForSettled(page);
    },
  },
];

test.describe('Visual Regression', () => {
  for (const screen of SCREENS) {
    test(`screenshot: ${screen.name}`, async ({ page }) => {
      await screen.go(page);

      await expect(page).toHaveScreenshot(`visual-${screen.name}.png`, {
        fullPage: true,
        mask: [page.locator('#overhang-clock'), ...(screen.mask ? screen.mask(page) : [])],
        maxDiffPixels: 1000,
      });
    });
  }
});

test('visual diff threshold check', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await waitForSettled(page);

  // Real diff against the committed home baseline.
  await expect(page).toHaveScreenshot('visual-home.png', {
    fullPage: true,
    mask: [page.locator('#overhang-clock')],
    maxDiffPixels: 1000,
  });
});
