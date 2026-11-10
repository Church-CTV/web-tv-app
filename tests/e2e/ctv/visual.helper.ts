/**
 * Shared helper for visual regression tests in CTV production preview.
 *
 * K6: capture deterministic primary + edge states for each platform at
 * 1920x1080. Fonts are pinned via the shared ctv fixtures (e2eFontCSS /
 * __e2e_font__ route) so baselines are deterministic across runners.
 *
 * `test` and `expect` are re-exported from './fixtures', which wire the
 * hermetic backend mocks + font pinning onto every page.
 */

import { type Locator, type Page } from '@playwright/test';
import { test, expect, waitForAppReady } from './fixtures';

/**
 * Wait for fade transitions and focus-ring animations to finish.
 */
async function waitForSettled(page: Page): Promise<void> {
  await page
    .locator('#splash-screen')
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(400);
}

export interface VisualState {
  name: string;
  /** Navigate the app to this screen state. */
  go: (page: Page) => Promise<void>;
  /** Dynamic regions excluded from the diff (moving digits, animating parts). */
  mask?: (page: Page) => Locator[];
}

/**
 * Run visual regression tests for the given list of states.
 *
 * Baselines live in tests/e2e/baseline/<platform>-visual-<name>.png (via the
 * playwright config pathTemplate) and are diffed on every run.
 */
export function defineVisualTests(states: VisualState[]): void {
  test.describe('Visual Regression', () => {
    for (const state of states) {
      test(`screenshot: ${state.name}`, async ({ page }) => {
        await state.go(page);
        await waitForSettled(page);

        await expect(page).toHaveScreenshot(`visual-${state.name}.png`, {
          fullPage: true,
          mask: [page.locator('#overhang-clock'), ...(state.mask ? state.mask(page) : [])],
          maxDiffPixels: 2000,
        });
      });
    }
  });
}

export { expect, waitForAppReady };
