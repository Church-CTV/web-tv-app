/**
 * K6: Visual regression baselines — webOS production preview (1920x1080).
 *
 * Captures deterministic screenshots of key screen states. Fonts are pinned
 * via the shared fixtures (e2eFontCSS) so baselines are stable across
 * local machines and CI runners.
 *
 * The WIP trimmed the webOS app to the Roku channel's 3 screens (Home/Search/
 * Settings) and selection now plays directly with no detail screen. Tizen and
 * Vizio still carry the full screen set (see their specs).
 *
 * Update baselines: npx playwright test --config playwright.ctv.config.ts
 *   --project=webos-production --update-snapshots
 */

import { waitForAppReady, expect } from './fixtures';
import { defineVisualTests } from './visual.helper';
import type { Page } from '@playwright/test';

/** Navigate to the video screen (home → first card plays directly). */
async function goToVideo(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const firstCard = page.locator('#content-grid .content-card').first();
  await firstCard.click();
  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
}

/** Navigate to a nav screen by left-nav label. */
async function goToNav(page: Page, label: string): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const link = page.locator(`.left-nav__item:has-text("${label}")`);
  await link.click();
  const targets: Record<string, string> = {
    Search: '.search-screen',
    Settings: '.settings-screen',
  };
  const sel = targets[label];
  if (!sel) throw new Error(`unknown nav label: ${label}`);
  await expect(page.locator(sel).first()).toBeVisible({ timeout: 5000 });
}

defineVisualTests([
  {
    name: 'home',
    go: async (page) => {
      await page.goto('/');
      await waitForAppReady(page);
    },
    // The overhang clock prints wall time, so an unmasked home baseline drifts
    // by seconds between runs. The video-player state already masks its
    // timecode; home had no mask at all until this fix (4be77ab-era layout
    // change made the diff large enough to notice).
    mask: (page) => [page.locator('#overhang-clock')],
  },
  {
    name: 'video-player',
    go: goToVideo,
    mask: (page) => [
      page.locator('#video-player'),
      page.locator('.video-screen__time'),
      page.locator('.video-screen__progress'),
    ],
  },
  {
    name: 'search',
    go: async (page) => {
      await goToNav(page, 'Search');
    },
  },
  {
    name: 'settings',
    go: async (page) => {
      await goToNav(page, 'Settings');
    },
  },
]);
