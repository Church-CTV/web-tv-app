#!/usr/bin/env node
/**
 * Package asset validity gate.
 *
 * Store review rejects channel packages whose icons are empty, 1-pixel art,
 * or missing. appinfo.json / config.xml / manifest.json all reference asset
 * paths (assets/icon-80.png, assets/splash.png, ...) that must exist in the
 * staged payload AND exceed a minimum byte size.
 *
 * package.sh runs this helper after staging and BEFORE creating the archive:
 *   node scripts/check-package-assets.mjs <platform> <stageDir>
 *
 * Exit 0 if every referenced asset exists and is > 1 KB. Exit 1 otherwise.
 *
 * The size floor is configurable: --min-kb N (default 1).
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Extract the referenced image asset paths from a webOS appinfo.json object.
 * Dedupes repeated references (bgImage and splashBackground often share one file).
 */
export function assetsFromWebOSAppInfo(appinfo) {
  const keys = ['icon', 'largeIcon', 'bgImage', 'splashBackground'];
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    const v = appinfo[k];
    if (typeof v === 'string' && v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Extract the referenced image asset paths from a Tizen config.xml string.
 * Looks for <icon src="..."/> elements (self-closing or slash-closed).
 */
export function assetsFromTizenConfig(xml) {
  const out = [];
  const seen = new Set();
  const re = /<icon\s+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const v = m[1];
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Extract the referenced image asset paths from a Vizio manifest.json object.
 * Collects all values in the icons map.
 */
export function assetsFromVizioManifest(manifest) {
  const out = [];
  const seen = new Set();
  const icons = manifest && typeof manifest.icons === 'object' ? manifest.icons : null;
  if (icons) {
    for (const v of Object.values(icons)) {
      if (typeof v === 'string' && v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

/**
 * Verify that every referenced asset exists in stageDir and exceeds the size floor.
 *
 * @param {string} stageDir  The staged payload directory to check.
 * @param {string[]} assets  The referenced asset paths (relative to stageDir).
 * @param {number} [minBytes=1024]  Minimum allowed file size in bytes.
 * @returns {{ok: boolean, missing: string[], tooSmall: string[]}}
 */
export function verifyStagedAssets(stageDir, assets, minBytes = 1024) {
  const missing = [];
  const tooSmall = [];
  for (const rel of assets) {
    const p = path.join(stageDir, rel);
    if (!fs.existsSync(p)) {
      missing.push(rel);
      continue;
    }
    const bytes = fs.statSync(p).size;
    if (bytes < minBytes) {
      tooSmall.push(rel);
    }
  }
  return { ok: missing.length === 0 && tooSmall.length === 0, missing, tooSmall };
}

/**
 * Load the platform manifest from its source directory and return the
 * referenced asset paths.
 *
 * @param {string} srcDir    Absolute path to the platform's source dir
 *                           (platforms/<platform>/).
 * @param {string} platform  One of 'webos' | 'tizen' | 'vizio'.
 */
export function assetsForPlatform(srcDir, platform) {
  switch (platform) {
    case 'webos': {
      const appinfo = JSON.parse(fs.readFileSync(path.join(srcDir, 'appinfo.json'), 'utf8'));
      return assetsFromWebOSAppInfo(appinfo);
    }
    case 'tizen': {
      const xml = fs.readFileSync(path.join(srcDir, 'config.xml'), 'utf8');
      return assetsFromTizenConfig(xml);
    }
    case 'vizio': {
      const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
      return assetsFromVizioManifest(manifest);
    }
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const platformName = process.argv[2];
  const stageDir = process.argv[3];
  const platformSrcDir = process.argv[4];
  // --min-kb N flag (optional)
  let minBytes = 1024;
  const minKbIdx = process.argv.indexOf('--min-kb');
  if (minKbIdx !== -1 && process.argv[minKbIdx + 1]) {
    minBytes = Math.round(parseFloat(process.argv[minKbIdx + 1]) * 1024);
  }

  if (!platformName || !stageDir || !platformSrcDir) {
    console.error(
      'Usage: node scripts/check-package-assets.mjs <webos|tizen|vizio> <stageDir> <platformSrcDir> [--min-kb N]'
    );
    process.exit(1);
  }

  const assets = assetsForPlatform(platformSrcDir, platformName);
  const r = verifyStagedAssets(stageDir, assets, minBytes);

  if (r.ok) {
    console.log(
      `[package-assets] ${platformName}: OK (${assets.length} assets, all > ${minBytes / 1024} KB)`
    );
  } else {
    process.exitCode = 1;
    if (r.missing.length) {
      console.error(`[package-assets] ${platformName}: FAIL missing: ${r.missing.join(', ')}`);
    }
    if (r.tooSmall.length) {
      console.error(
        `[package-assets] ${platformName}: FAIL too small (<${minBytes / 1024} KB): ${r.tooSmall.join(', ')}`
      );
    }
  }
}
