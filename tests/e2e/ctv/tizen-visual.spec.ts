/**
 * K6: Visual regression baselines — Tizen production preview (1920x1080).
 *
 * Fonts pinned via shared fixtures (e2eFontCSS). Tizen has no content-detail
 * screen — clicking a card goes straight to the video screen.
 *
 * Update baselines: npx playwright test --config playwright.ctv.config.ts
 *   --project=tizen -g "Visual Regression" --update-snapshots
 */

import { waitForAppReady, expect } from './fixtures';
import { defineVisualTests } from './visual.helper';
import type { Page } from '@playwright/test';

async function goToVideo(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const firstCard = page.locator('#content-grid .content-card').first();
  await firstCard.click();
  await expect(page.locator('#video-player')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
}

async function goToNav(page: Page, label: string): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const link = page.locator(`.left-nav__item:has-text("${label}")`);
  await link.click();
  // HD leftnav (96a7cad) carries only Home / Search / Settings. Schedule,
  // Continue, Watch Later, and Subscribe are no longer in the Tizen nav, so
  // they are not navigable and have no visual baselines.
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
      page.locator('.video-screen__progress-bar'),
    ],
  },
  {
    name: 'search',
    go: async (page) => {
      await goToNav(page, 'Search');
      const key = page.locator('#screen-search .osk-key').first();
      await key.focus();
      await expect(key).toBeFocused();
    },
  },
  {
    name: 'settings',
    go: async (page) => {
      await goToNav(page, 'Settings');
      const link = page.locator('#screen-settings .settings-give__link');
      await link.focus();
      await expect(link).toBeFocused();
    },
  },
]);
