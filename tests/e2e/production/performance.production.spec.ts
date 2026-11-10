/**
 * E2E: PRODUCTION bundle-size verification.
 *
 * Runs against the real `vite build` output via `vite preview` (production
 * build), NOT the dev server. This is the authoritative production perf gate:
 * it measures the bytes of the actual shipped JS/CSS bundle and asserts it is
 * under the documented budget in scripts/bundle-budgets.json.
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'scripts', 'bundle-budgets.json');

test.use({ baseURL: 'http://localhost:4173' });

test.describe('production bundle size gate', () => {
  test('serves a hashed production JS bundle (not the dev server)', async ({ page }) => {
    // Stub the vendored webOS SDK (hermetic) and collect /assets/ URLs.
    const assetsJsUrls: string[] = [];
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/vendor/webOSTV.js')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '/* webOSTV.js stubbed */',
        });
      }
      if (url.includes('/assets/') && url.includes('.js')) {
        assetsJsUrls.push(url);
      }
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(assetsJsUrls.length).toBeGreaterThan(0);
  });

  test('production JS+CSS bundle stays under the documented budget', async ({ page }) => {
    const budgets: Record<string, { kbLimit: number }> = JSON.parse(
      fs.readFileSync(BUDGETS_PATH, 'utf-8')
    );
    const kbLimit = budgets.webos.kbLimit;

    let jsBytes = 0;
    let cssBytes = 0;

    // Observe real response bytes without interfering with the preview server.
    page.on('response', async (resp) => {
      const ct = resp.headers()['content-type'] || '';
      const url = resp.url();
      if (!url.includes('/assets/')) return;
      if (ct.includes('javascript')) {
        jsBytes += (await resp.body()).length;
      } else if (ct.includes('css')) {
        cssBytes += (await resp.body()).length;
      }
    });

    // Stub the vendored webOS SDK (hermetic).
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/vendor/webOSTV.js')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '/* webOSTV.js stubbed */',
        });
      }
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // let async response handlers flush

    const totalKb = (jsBytes + cssBytes) / 1024;

    expect(totalKb, 'expected a non-trivial production bundle to be served').toBeGreaterThan(5);
    expect(
      totalKb,
      `production bundle is ${totalKb.toFixed(1)} KB, over the ${kbLimit} KB budget`
    ).toBeLessThanOrEqual(kbLimit);

    console.log(
      `[perf-gate] production bundle = ${totalKb.toFixed(1)} KB (JS ${(jsBytes / 1024).toFixed(1)} + CSS ${(cssBytes / 1024).toFixed(1)}), budget = ${kbLimit} KB`
    );
  });
});
