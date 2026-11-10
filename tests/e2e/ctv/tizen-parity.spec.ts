/**
 * Tizen-to-webOS production geometry parity (Tizen store-readiness gate).
 *
 * webOS implements the pinned Roku source geometry; this checks consistency,
 * not a paired Roku runtime capture. the Tizen build must render
 * the same UI at 1920x1080. Runs in the `tizen` CTV project (baseURL 4181)
 * and reaches the webOS production preview (4180) by absolute URL; both
 * servers are booted by playwright.ctv.config.ts webServer entries.
 *
 * Selector facts verified against the live webOS production build on
 * 2026-10-23: active screen = '.screen-active', home = '#screen-grid',
 * focus ring = outline (3px solid), card title element '.content-card__title'
 * with display:none (Roku-parity image-only cards), clock = '#overhang-clock'.
 *
 * Provenance: ported from the acceptance harness
 * (.hermes/cache/scratch/tizen-parity-harness.mjs) which caught the
 * card-size, grid-pitch, focus-ring, clock, title-band and container-set
 * drifts this spec now pins as a blocking gate.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const WEBOS_URL = 'http://localhost:4180/';

type Metrics = {
  cardCount: number;
  cardBox: { w: number; h: number };
  pitch: number;
  focusRing: string;
  clockText: string;
  logoVisible: boolean;
  screenIds: string[];
  titleDisplay: string;
  navBtnWidth: number;
};

async function capture(page: Page, url: string): Promise<Metrics> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.content-card').length >= 4, null, {
    timeout: 20000,
  });
  await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 15000 });
  await page.locator('.content-card').first().focus();
  // Compare settled focused geometry; sampling a card mid-transition
  // makes the measurements depend on scheduler load.
  await expect
    .poll(async () =>
      Math.round((await page.locator('.content-card').first().boundingBox())?.width ?? 0)
    )
    .toBe(480);
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.content-card'));
    const first = cards[0] as HTMLElement;
    const second = cards[1] as HTMLElement;
    const focused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.classList.contains('content-card')
        ? document.activeElement
        : (first.focus(), first);
    // The ring is painted by the poster layer, not the card box: the card is a
    // positioned container whose own outline is suppressed so the shared red
    // ring cannot halo it (df2bdd3, 49f1e9a). Reading the card now yields
    // "3px none" on BOTH platforms, which made the drift check pass while the
    // sanity check below failed - the assertion had silently stopped measuring
    // anything visible. Compare the element that actually paints the ring.
    const ringHost =
      (focused.querySelector(
        '.content-card__poster-img, .content-card__poster-fallback'
      ) as HTMLElement | null) ?? focused;
    const fs = getComputedStyle(ringHost);
    const nav = document.querySelector('#left-nav button, #left-nav a') as HTMLElement | null;
    const clock = document.querySelector('#overhang-clock');
    const title = document.querySelector('.content-card .content-card__title');
    return {
      cardCount: cards.length,
      cardBox: {
        w: Math.round(first.getBoundingClientRect().width),
        h: Math.round(first.getBoundingClientRect().height),
      },
      pitch: Math.round(
        Math.abs(second.getBoundingClientRect().left - first.getBoundingClientRect().left)
      ),
      focusRing: `${fs.outlineWidth} ${fs.outlineStyle}`,
      clockText: (clock?.textContent ?? '').trim(),
      logoVisible: (() => {
        const img = document.querySelector<HTMLImageElement>(
          '#overhang .overhang-logo img, #overhang img.overhang-logo, #overhang img.overhang__logo, #overhang .overhang__logo img'
        );
        return Boolean(img && img.naturalWidth > 0 && img.getBoundingClientRect().width > 0);
      })(),
      screenIds: Array.from(document.querySelectorAll('[id^="screen-"]'))
        .map((el) => el.id)
        .sort(),
      titleDisplay: title ? getComputedStyle(title).display : 'absent',
      navBtnWidth: nav ? Math.round(nav.getBoundingClientRect().width) : -1,
    };
  });
}

test('Tizen production build is geometry-identical to the webOS Roku-parity reference', async ({
  page,
}) => {
  const tizen = await capture(page, '/');
  const webos = await capture(page, WEBOS_URL);

  // Cards: same size and pitch
  expect(Math.abs(tizen.cardBox.w - webos.cardBox.w), 'card width drift').toBeLessThanOrEqual(2);
  expect(Math.abs(tizen.cardBox.h - webos.cardBox.h), 'card height drift').toBeLessThanOrEqual(2);
  expect(Math.abs(tizen.pitch - webos.pitch), 'grid pitch drift').toBeLessThanOrEqual(2);

  // Focus ring identical (width + style)
  expect(tizen.focusRing, 'focus ring drift').toBe(webos.focusRing);
  expect(webos.focusRing, 'reference focus ring sanity').toMatch(/^[\d.]+px solid$/);

  // Overhang clock present and formatted on both
  expect(webos.clockText, 'webOS reference clock missing').toMatch(/\d{1,2}:\d{2}/);
  expect(tizen.clockText, 'Tizen clock missing').toMatch(/\d{1,2}:\d{2}/);

  // Overhang brand logo renders (real decoded image, visible) on both
  expect(webos.logoVisible, 'webOS reference logo sanity').toBe(true);
  expect(tizen.logoVisible, 'Tizen overhang logo must render like the reference').toBe(true);

  // Exact same screen-container set
  expect(webos.screenIds, 'reference container set sanity').toEqual(
    expect.arrayContaining(['screen-grid', 'screen-video', 'screen-search', 'screen-settings'])
  );
  expect(tizen.screenIds, 'Tizen screen-container set drift').toEqual(webos.screenIds);
  for (const forbidden of [
    'screen-schedule',
    'screen-continue',
    'screen-continue-watching',
    'screen-watch-later',
    'screen-subscription',
  ]) {
    expect(tizen.screenIds, `forbidden screen ${forbidden} on Tizen`).not.toContain(forbidden);
  }

  // Roku-parity cards are image-only: title element hidden on both platforms
  expect(webos.titleDisplay, 'reference card title sanity').toBe('none');
  expect(tizen.titleDisplay, 'Tizen card title must be display:none like the reference').toBe(
    'none'
  );

  // Nav button geometry
  expect(webos.navBtnWidth).toBeGreaterThan(0);
  expect(
    Math.abs(tizen.navBtnWidth - webos.navBtnWidth),
    'nav button width drift'
  ).toBeLessThanOrEqual(2);
});

test('Tizen card selection opens fullscreen playback directly (no detail screen)', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.content-card').length >= 4, null, {
    timeout: 20000,
  });
  // The boot splash overlay (pointer-events: auto until dismissed) can
  // swallow an early click, leaving the video unplayed at its 300px default.
  await page.waitForFunction(() => !document.getElementById('splash-screen'), null, {
    timeout: 10000,
  });
  await page.locator('.content-card').first().click();
  // Terminal playback state only: the <video> sits at its 300px intrinsic
  // width until stream metadata loads (webOS hides this behind its loader;
  // the end state on both platforms is identical fullscreen playback).
  await page.waitForFunction(
    () => {
      const v = document.querySelector('video');
      const active = document.querySelector('.screen-active')?.id;
      return active === 'screen-video' && Boolean(v && v.getBoundingClientRect().width > 1000);
    },
    null,
    { timeout: 10000 }
  );
  const state = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      videoWidth: v ? Math.round(v.getBoundingClientRect().width) : 0,
      activeScreen: document.querySelector('.screen-active')?.id ?? null,
    };
  });
  expect(state.videoWidth, 'playback must start fullscreen').toBeGreaterThan(1000);
  if (state.activeScreen) {
    expect(state.activeScreen, 'active screen must be video').toBe('screen-video');
  }
});
