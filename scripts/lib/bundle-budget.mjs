/**
 * Production bundle-size gate logic (pure, no CLI side effects).
 *
 * Exported helpers are unit-tested at ./bundle-budget.test.mjs. The CLI
 * entry (scripts/check-bundle-budget.mjs) imports from here.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} BundleBudget
 * @property {number} kbLimit - Raw bundle size limit in kilobytes.
 * @property {string} distDir - Production output dir, relative to repo root.
 */

/**
 * @typedef {Object} MeasuredSize
 * @property {number} bytes
 * @property {number} fileCount
 */

/**
 * Recursively sum the raw bytes of all files in a directory, ignoring
 * source maps (.map). Source maps are not shipped to devices.
 *
 * @param {string} dir
 * @returns {MeasuredSize}
 */
export function measureBundleSize(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`dist directory not found: ${dir}`);
  }
  let bytes = 0;
  let fileCount = 0;

  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!entry.name.endsWith('.map')) {
        const size = fs.statSync(full).size;
        bytes += size;
        fileCount += 1;
      }
    }
  };

  walk(dir);
  return { bytes, fileCount };
}

/**
 * Compare measured sizes against budgets. A missing measured size is a
 * failure — you cannot certify a budget you never measured.
 *
 * @param {Record<string, BundleBudget>} budgets
 * @param {Record<string, MeasuredSize | null>} sizes
 * @returns {{ pass: boolean, failures: Array<{platform:string,kbLimit:number,actualKb:number|null,reason:string}> }}
 */
export function evaluateBudgets(budgets, sizes) {
  const failures = [];

  for (const [platform, budget] of Object.entries(budgets)) {
    const measured = sizes[platform];
    if (!measured || measured.bytes == null) {
      failures.push({
        platform,
        kbLimit: budget.kbLimit,
        actualKb: null,
        reason: 'not measured (dist missing or build did not run)',
      });
      continue;
    }

    const actualKb = measured.bytes / 1024;
    if (actualKb > budget.kbLimit) {
      failures.push({
        platform,
        kbLimit: budget.kbLimit,
        actualKb,
        reason: `exceeds budget by ${(actualKb - budget.kbLimit).toFixed(1)} KB`,
      });
    }
  }

  return { pass: failures.length === 0, failures };
}

/**
 * Read budgets from a JSON file. Throws on missing or malformed config.
 *
 * @param {string} configPath
 * @returns {Record<string, BundleBudget>}
 */
export function readBudgets(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`budget config not found: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`budget config is not a JSON object: ${configPath}`);
  }
  return parsed;
}
