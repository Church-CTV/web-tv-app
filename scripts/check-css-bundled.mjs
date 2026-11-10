#!/usr/bin/env node
/**
 * Production shared-CSS bundle gate.
 *
 * After `vite build`, each platform's dist/index.html must reference a
 * single hashed CSS asset that actually exists in dist/assets/. This is the
 * build-time proof that shared/styles/*.css was bundled (E2) rather than left
 * as a runtime ../shared/styles link (which would be missing from the package).
 *
 * The channel package scripts (package.sh) stage dist/ into .ipk/.wgt/.zip, so
 * if the CSS is present in dist and referenced by index.html, it ships.
 *
 * Usage:
 *   node scripts/check-css-bundled.mjs
 *
 * Exits 1 if any platform is missing a bundled, referenced CSS asset.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const PLATFORMS = ['webos', 'tizen', 'vizio'];

/**
 * Rules the shipped UI cannot render without, asserted against the built stylesheet
 * rather than the source sheet. Every unit suite reads platforms/<p>/src/styles.css,
 * so a rule that exists in source and never reaches dist - a lost @import, a changed
 * build config, an over-aggressive minifier - leaves a green suite and an app whose
 * stall row, error dialog or focus ring paints nothing on a real set.
 *
 * Scoped to rules present in all three platforms' built CSS (measured, not assumed):
 * `.error-dialog-container` is tizen/vizio-only (webOS dims with `.video-error`) and
 * `.focus-meta` is tizen-only, so neither belongs in a cross-platform requirement.
 */
export const REQUIRED_SELECTORS = [
  '.video-buffering',
  '.error-dialog',
  '.error-dialog__button',
  '.content-card__poster-img',
];

export function cssHrefFromHtml(html) {
  const m = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export function verifyPlatform(root, platform) {
  const dir = path.join(root, 'platforms', platform, 'dist');
  const htmlPath = path.join(dir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    return { platform, ok: false, error: 'dist/index.html missing' };
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const href = cssHrefFromHtml(html);
  if (!href) {
    return { platform, ok: false, error: 'no stylesheet link found in index.html' };
  }
  const resolved = path.join(dir, href.replace(/^\//, ''));
  if (!fs.existsSync(resolved)) {
    return { platform, ok: false, error: `referenced CSS not in dist: ${href}` };
  }
  // The asset existing is not the same as the app being styled: read the sheet the
  // package will actually contain and require the rules its UI depends on. Every
  // missing one is reported together so a single run tells the whole story.
  const css = fs.readFileSync(resolved, 'utf8');
  const missing = REQUIRED_SELECTORS.filter((sel) => !css.includes(sel));
  if (missing.length) {
    return { platform, ok: false, error: `bundled CSS is missing ${missing.join(', ')}` };
  }
  return { platform, ok: true, href, sizeKb: (fs.statSync(resolved).size / 1024).toFixed(1) };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  // Optional positional filter: limit to one platform (used by package.sh).
  const filter = process.argv[2];
  const targets = filter ? PLATFORMS.filter((p) => p === filter) : PLATFORMS;
  if (filter && !targets.length) {
    console.error(
      `[css-bundled] unknown platform '${filter}' (expected one of ${PLATFORMS.join(', ')})`
    );
    process.exit(1);
  }
  let failed = false;
  for (const p of targets) {
    const r = verifyPlatform(repoRoot, p);
    if (r.ok) {
      console.log(`[css-bundled] ${p}: OK ${r.href} (${r.sizeKb} KB)`);
    } else {
      failed = true;
      console.error(`[css-bundled] ${p}: FAIL ${r.error}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
