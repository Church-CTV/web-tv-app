/**
 * Production code-splitting gate logic (pure, no CLI side effects).
 *
 * Exported helpers are unit-tested at ./code-split.test.mjs. The CLI
 * entry (scripts/check-code-split.mjs) imports from here.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} CodeSplitConfig
 * @property {string} distDir - Production output dir, relative to repo root.
 * @property {number} maxEntryKb - Maximum allowed raw entry chunk size in KB.
 * @property {number} minChunks - Minimum number of non-entry chunks required.
 */

/**
 * @typedef {Object} CodeSplitResult
 * @property {boolean} pass
 * @property {number|null} entryKb
 * @property {number} chunkCount
 * @property {string[]} failures
 */

/**
 * Find the entry chunk filename in a dist/assets directory.
 *
 * Vite names the entry chunk as `index-<hash>.js` (per the platform
 * vite config entryFileNames: 'assets/[name].[hash].js'). Returns null
 * when no entry chunk is found.
 *
 * @param {string} distDir - The dist directory to search.
 * @returns {string|null} - The entry chunk filename, or null.
 */
export function findEntryChunk(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) return null;

  const files = fs.readdirSync(assetsDir);
  // Vite names the entry chunk as index.<hash>.js (dot separator).
  // The hash may contain alphanumeric chars and underscores (e.g. BAqlUmee,
  // Dw0xu3_u). We look for this pattern but exclude .js.map files.
  const entryPattern = /^index\.[a-zA-Z0-9_-]+\.js$/;
  const match = files.find((f) => entryPattern.test(f));
  return match || null;
}

/**
 * Count non-entry .js chunks in a dist/assets directory.
 *
 * @param {string} distDir - The dist directory to search.
 * @returns {number} - Number of lazy chunks found.
 */
export function countLazyChunks(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) return 0;

  const files = fs.readdirSync(assetsDir);
  const entryName = findEntryChunk(distDir);

  const nonEntry = files.filter(
    (f) => f.endsWith('.js') && !f.endsWith('.map') && !f.endsWith('.css') && f !== entryName
  );
  return nonEntry.length;
}

/**
 * Evaluate whether the webOS dist satisfies code-splitting requirements.
 *
 * Checks:
 * 1. Entry chunk exists.
 * 2. Entry chunk is within the maxEntryKb budget.
 * 3. At least minChunks non-entry chunks exist (proves dynamic imports
 *    are present in the build output).
 *
 * @param {string} distDir - Absolute path to the dist directory.
 * @param {CodeSplitConfig} config - Budget and requirements.
 * @returns {CodeSplitResult}
 */
export function evaluateCodeSplit(distDir, config) {
  const failures = [];

  if (!fs.existsSync(distDir)) {
    return {
      pass: false,
      entryKb: null,
      chunkCount: 0,
      failures: ['dist directory not found: ' + distDir],
    };
  }

  const entryName = findEntryChunk(distDir);
  const chunkCount = countLazyChunks(distDir);
  const entryPath = entryName ? path.join(distDir, 'assets', entryName) : null;
  const entryBytes = entryPath ? fs.statSync(entryPath).size : 0;
  const entryKb = entryBytes / 1024;

  if (!entryName) {
    failures.push('no entry chunk found (index-*.js missing in dist/assets)');
  }

  if (entryKb > config.maxEntryKb) {
    failures.push(
      `entry chunk ${entryKb.toFixed(1)} KB exceeds budget of ${config.maxEntryKb} KB — add more dynamic imports`
    );
  }

  if (chunkCount < config.minChunks) {
    failures.push(
      `only ${chunkCount} lazy chunk(s) found, need at least ${config.minChunks} — code splitting is not in effect`
    );
  }

  return {
    pass: failures.length === 0,
    entryKb: entryName ? Math.round(entryKb * 10) / 10 : null,
    chunkCount,
    failures,
  };
}
