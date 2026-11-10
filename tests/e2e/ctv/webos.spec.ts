/**
 * E2E Smoke Tests: webOS production preview (vite preview @ 1920x1080).
 *
 * This mirrors the existing production perf-gate coverage but exercises the
 * functional UI at CTV resolution. We intentionally do NOT duplicate the
 * existing dev-server E2E suite here — this is a thin smoke test for the
 * production bundle.
 *
 * J2c: Offline startup, DNS failure, malformed feed, partial response, and
 * retry recovery are verified here via the shared j2c.helper factory.
 * Parity tests for Tizen and Vizio live in tizen.spec.ts and vizio.spec.ts.
 */

import { test, expect, waitForAppReady } from './fixtures';
import { defineJ2cTests } from './j2c.helper';

test('home screen boots in production bundle', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await expect(page.locator('#content-grid')).toBeVisible();
  await expect(page.locator('#content-grid .content-card').first()).toBeVisible();
  await expect(page.locator('.left-nav')).toBeVisible();
});

// ─── J2c: Offline startup and recovery matrix ────────────────────────────

defineJ2cTests({ errorScreen: '.error-screen', retryBtn: '#btn-retry' });
