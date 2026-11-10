#!/usr/bin/env node
/**
 * Manifest completeness gate for store-ready packages.
 *
 * A network-accessing CTV channel must declare platform privileges that are
 * enforced at install time. If config.xml / manifest.json omits them, the
 * package builds and tests pass, but the app cannot reach the server on a real
 * TV (XMLHttpRequest / fetch are blocked by the OS sandbox).
 *
 * Usage (run from repo root, called by each platform's package.sh):
 *   node scripts/check-manifest-completeness.mjs <webos|tizen|vizio> <srcDir>
 *
 * - tizen:  asserts config.xml declares http://tizen.org/privilege/internet AND
 *           the http://tizen.org/feature/screen.size.all <feature> (Samsung TV
 *           launch checklist requires the screen size declared via <feature>).
 * - vizio:  asserts manifest.json declares every required store field
 * - webos:  appinfo.json needs no internet privilege (webOS permits network by
 *           default); we still assert it parses and has id/version.
 *
 * Exit 0 when complete, 1 otherwise (fail closed).
 */

import fs from 'node:fs';
import path from 'node:path';

/** The privilege a Tizen app needs to use XMLHttpRequest / WebSocket. */
export const TIZEN_INTERNET_PRIVILEGE = 'http://tizen.org/privilege/internet';

/**
 * The screen-size feature a Tizen TV app must declare. Samsung's launch
 * checklist requires the screen size to be declared via a <feature> tag;
 * screen.size.all is the TV-app value (matches our fixed 1920x1080 UI).
 */
export const TIZEN_SCREEN_FEATURE = 'http://tizen.org/feature/screen.size.all';

/** <feature> tags a Tizen TV app must declare for store submission. */
export const TIZEN_REQUIRED_FEATURES = [TIZEN_SCREEN_FEATURE];

/** Required Vizio SmartCast manifest fields for store submission. */
export const VIZIO_REQUIRED_FIELDS = ['name', 'version', 'main', 'start_url', 'icons'];

/**
 * Extract all tizen:privilege name values from a Tizen config.xml string.
 * Preserves document order, deduped.
 */
export function tizenPrivileges(xml) {
  const out = [];
  const seen = new Set();
  const re = /<tizen:privilege\s+name=["']([^"']+)["']/gi;
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
 * Extract all <feature name="..."> values from a Tizen config.xml string.
 * Preserves document order, deduped.
 */
export function tizenFeatures(xml) {
  const out = [];
  const seen = new Set();
  const re = /<feature\s+name=["']([^"']+)["']/gi;
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
 * Check that a Tizen config.xml declares every required privilege AND feature
 * for a network TV app.
 *
 * @param {string} xml The config.xml contents.
 * @param {string[]} [requiredPrivileges] Privileges that must be present.
 * @param {string[]} [requiredFeatures] Features that must be present.
 * @returns {{ok: boolean, missing: string[], missingFeatures: string[], privileges: string[], features: string[]}}
 */
export function tizenManifestCompleteness(
  xml,
  requiredPrivileges = [TIZEN_INTERNET_PRIVILEGE],
  requiredFeatures = TIZEN_REQUIRED_FEATURES
) {
  const privs = tizenPrivileges(xml);
  const feats = tizenFeatures(xml);
  const privSet = new Set(privs);
  const featSet = new Set(feats);
  const missing = requiredPrivileges.filter((p) => !privSet.has(p));
  const missingFeatures = requiredFeatures.filter((f) => !featSet.has(f));
  return {
    ok: missing.length === 0 && missingFeatures.length === 0,
    missing,
    missingFeatures,
    privileges: privs,
    features: feats,
  };
}

/**
 * Check that a Vizio manifest.json object has every required field (non-empty).
 *
 * @param {object} manifest Parsed manifest.json object.
 * @returns {{ok: boolean, missing: string[]}}
 */
export function vizioManifestCompleteness(manifest) {
  const missing = VIZIO_REQUIRED_FIELDS.filter((k) => {
    const v = manifest ? manifest[k] : undefined;
    if (v === undefined || v === null || v === '') return true;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true;
    return false;
  });
  return { ok: missing.length === 0, missing };
}

/**
 * Load the platform manifest from its source directory and return the
 * completeness result for it.
 *
 * @param {string} srcDir Absolute path to platforms/<platform>/.
 * @param {string} platform One of 'webos' | 'tizen' | 'vizio'.
 * @returns {{ok: boolean, missing: string[], note: string}}
 */
export function completenessForPlatform(srcDir, platform) {
  switch (platform) {
    case 'tizen': {
      const xml = fs.readFileSync(path.join(srcDir, 'config.xml'), 'utf8');
      const r = tizenManifestCompleteness(xml);
      const parts = [];
      if (r.missing.length > 0) parts.push(`missing privileges: ${r.missing.join(', ')}`);
      if (r.missingFeatures.length > 0)
        parts.push(`missing features: ${r.missingFeatures.join(', ')}`);
      return {
        ...r,
        note: r.ok ? 'privileges + required features present' : parts.join('; '),
      };
    }
    case 'vizio': {
      const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
      const r = vizioManifestCompleteness(manifest);
      return {
        ...r,
        note: r.ok ? 'manifest complete' : `missing manifest fields: ${r.missing.join(', ')}`,
      };
    }
    case 'webos': {
      const appinfo = JSON.parse(fs.readFileSync(path.join(srcDir, 'appinfo.json'), 'utf8'));
      if (!appinfo.id || !appinfo.version) {
        return { ok: false, missing: ['id|version'], note: 'appinfo.json missing id/version' };
      }
      return { ok: true, missing: [], note: 'appinfo ok (webOS permits network by default)' };
    }
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const platformName = process.argv[2];
  const srcDir = process.argv[3];

  if (!platformName || !srcDir) {
    console.error(
      'Usage: node scripts/check-manifest-completeness.mjs <webos|tizen|vizio> <srcDir>'
    );
    process.exit(1);
  }

  const r = completenessForPlatform(srcDir, platformName);
  if (r.ok) {
    console.log(`[manifest-complete] ${platformName}: OK (${r.note})`);
  } else {
    process.exitCode = 1;
    console.error(`[manifest-complete] ${platformName}: FAIL (${r.note})`);
  }
}
