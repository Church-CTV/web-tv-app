#!/usr/bin/env node
/**
 * Production bundle-size gate CLI.
 *
 * CI calls this AFTER `vite build` on all platforms. It measures each
 * platform's real production bundle and fails the build (exit 1) if any
 * platform exceeds its documented budget.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs [budgets.json]
 *
 * Defaults to scripts/bundle-budgets.json.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureBundleSize, evaluateBudgets, readBudgets } from './lib/bundle-budget.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function main() {
  const configArg = process.argv[2];
  const configPath = configArg
    ? path.resolve(configArg)
    : path.join(repoRoot, 'scripts', 'bundle-budgets.json');

  let budgets;
  try {
    budgets = readBudgets(configPath);
  } catch (e) {
    console.error(`[bundle-budget] FATAL: ${e.message}`);
    process.exit(1);
  }

  const sizes = {};
  for (const [platform, budget] of Object.entries(budgets)) {
    const distDir = path.resolve(repoRoot, budget.distDir);
    try {
      sizes[platform] = measureBundleSize(distDir);
    } catch {
      // Missing dist → leave unset so evaluateBudgets reports it as a miss.
      sizes[platform] = null;
    }
  }

  const result = evaluateBudgets(budgets, sizes);

  console.log('\n[bundle-budget] Production bundle size gate');
  console.log('─'.repeat(52));
  for (const [platform, budget] of Object.entries(budgets)) {
    const measured = sizes[platform];
    const actual = measured ? (measured.bytes / 1024).toFixed(1) + ' KB' : 'MISSING';
    const ok = !result.failures.some((f) => f.platform === platform);
    console.log(`  ${ok ? '✓' : '✗'} ${platform}: ${actual} (limit ${budget.kbLimit} KB)`);
  }

  if (result.pass) {
    console.log('─'.repeat(52));
    console.log('[bundle-budget] PASS — all bundles within budget');
    process.exit(0);
  } else {
    console.log('─'.repeat(52));
    console.error('[bundle-budget] FAIL — budget exceeded:');
    for (const f of result.failures) {
      console.error(
        `  ✗ ${f.platform}: ${
          f.actualKb != null ? f.actualKb.toFixed(1) + ' KB' : 'not measured'
        } > ${f.kbLimit} KB — ${f.reason}`
      );
    }
    console.error('\nReduce the bundle size or raise the documented budget intentionally.');
    process.exit(1);
  }
}

main();
