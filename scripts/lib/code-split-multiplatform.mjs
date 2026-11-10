/**
 * Multi-platform code-splitting gate logic (pure, no CLI side effects).
 *
 * Evaluates ALL platforms (webOS, Tizen, Vizio) to ensure code splitting
 * is in effect on each one. Unit-tested at ./code-split-multiplatform.test.mjs.
 */

import { evaluateCodeSplit } from './code-split.mjs';

/**
 * @typedef {Object} MultiPlatformConfig
 * @property {number} maxEntryKb - Maximum allowed raw entry chunk size in KB.
 * @property {number} minChunks - Minimum number of non-entry chunks required.
 * @property {string[]} platforms - List of platform names to check.
 */

/**
 * @typedef {Object} PlatformResult
 * @property {string} platform - Platform name.
 * @property {boolean} pass - Whether this platform passed.
 * @property {number|null} entryKb - Entry chunk size in KB.
 * @property {number} chunkCount - Number of lazy chunks.
 * @property {string[]} failures - Failure messages.
 */

/**
 * @typedef {Object} MultiPlatformResult
 * @property {boolean} pass - Overall pass (all platforms pass).
 * @property {PlatformResult[]} results - Per-platform results.
 */

/**
 * Evaluate code splitting across all platforms.
 *
 * @param {string} repoRoot - Absolute path to repo root.
 * @param {MultiPlatformConfig} config - Budget and platform list.
 * @returns {MultiPlatformResult}
 */
export function evaluateAllCodeSplit(repoRoot, config) {
  const { platforms = [] } = config;
  const baseConfig = {
    distDir: '', // unused here; evaluateCodeSplit takes distDir directly
    maxEntryKb: config.maxEntryKb,
    minChunks: config.minChunks,
  };

  const results = [];

  for (const platform of platforms) {
    const distDir = `${repoRoot}/platforms/${platform}/dist`;

    const platformResult = evaluateCodeSplit(distDir, baseConfig);

    results.push({
      platform,
      pass: platformResult.pass,
      entryKb: platformResult.entryKb,
      chunkCount: platformResult.chunkCount,
      failures: platformResult.failures,
    });
  }

  const pass = results.every((r) => r.pass);

  return { pass, results };
}
