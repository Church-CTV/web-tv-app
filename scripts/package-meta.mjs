#!/usr/bin/env node
/**
 * F3 — package metadata helper for webOS packager selection.
 *
 * `platforms/webos/scripts/package.sh` uses `ares-package` when the LG webOS
 * TV SDK is present, otherwise falls back to a tar-based packager so CI works
 * without the proprietary SDK. LG Seller Lounge expects ares-package output;
 * the tar fallback is for CI/diagnostic only and is NOT store-submittable.
 *
 * This helper centralises the metadata written to `build/package-meta.json`
 * so the distinction is explicit, testable, and cannot silently regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build the metadata object for a webOS channel package.
 * @param {'ares'|'tar'} packager which packager produced the .ipk
 * @param {{appId: string, version: string, file: string}} info
 * @returns {object} the metadata object to be written to package-meta.json
 */
export function buildMeta(packager, { appId, version, file }) {
  if (packager !== 'ares' && packager !== 'tar') {
    throw new Error(`unknown packager: ${packager}`);
  }
  return {
    platform: 'webos',
    appId,
    version,
    file,
    packager,
    storeReady: packager === 'ares',
  };
}

/**
 * Whether a package-meta object is store-submittable (ares-built).
 * @param {object} meta
 * @returns {boolean}
 */
export function isStoreReady(meta) {
  return !!meta && meta.storeReady === true && meta.packager === 'ares';
}

// CLI entry point (called from package.sh):
//   node scripts/package-meta.mjs --packager <ares|tar> \
//     --app-id <id> --version <v> --file <path> --out <path>
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const packager = get('--packager');
  const appId = get('--app-id');
  const version = get('--version');
  const file = get('--file');
  const out = get('--out');
  if (!packager || !appId || !version || !file || !out) {
    console.error(
      'Usage: package-meta.mjs --packager <ares|tar> --app-id <id> --version <v> --file <path> --out <path>'
    );
    process.exit(1);
  }
  const meta = buildMeta(packager, { appId, version, file });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(meta, null, 2) + '\n');
  console.log(`[package-meta] ${out} packager=${meta.packager} storeReady=${meta.storeReady}`);
}
