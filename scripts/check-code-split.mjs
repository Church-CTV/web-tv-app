#!/usr/bin/env node
/**
 * Production code-splitting gate CLI.
 *
 * CI calls this AFTER `vite build` on all platforms. It verifies that each
 * platform's production bundle has real code splitting (lazy chunks via
 * dynamic imports) and that the entry chunk is below a size budget.
 *
 * Exits 1 and prints a diagnostic if code splitting is missing on any platform.
 *
 * Usage:
 *   node scripts/check-code-split.mjs [config.json]
 *
 * Defaults to scripts/code-split-config.json.
 *
 * Config format (per-platform budgets):
 *   {
 *     "webos": { "maxEntryKb": 55, "minChunks": 2 },
 *     "tizen": { "maxEntryKb": 30, "minChunks": 2 },
 *     "vizio": { "maxEntryKb": 30, "minChunks": 2 }
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCodeSplit } from './lib/code-split.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Load config supporting both legacy single-platform and new multi-platform
 * formats.
 *
 * @param {string|undefined} configArg
 * @returns {{ configPath: string, budgets: Record<string, {maxEntryKb: number, minChunks: number}> }}
 */
function loadConfig(configArg) {
  const configPath = configArg
    ? path.resolve(configArg)
    : path.join(repoRoot, 'scripts', 'code-split-config.json');
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Legacy single-platform format:
  // { "distDir": "platforms/webos/dist", "maxEntryKb": 55, "minChunks": 2 }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.distDir) {
    const platform = path.basename(path.dirname(parsed.distDir));
    return {
      configPath,
      budgets: { [platform]: { maxEntryKb: parsed.maxEntryKb, minChunks: parsed.minChunks } },
    };
  }

  return { configPath, budgets: parsed };
}

function main() {
  const { configPath, budgets } = loadConfig(process.argv[2]);
  const platforms = Object.keys(budgets);

  console.log('\n[code-split] Production code-splitting gate');
  console.log('─'.repeat(60));
  console.log(`  Config: ${path.relative(repoRoot, configPath)}`);

  let overallPass = true;
  const failures = [];

  for (const platform of platforms) {
    const budget = budgets[platform];
    const distDir = path.resolve(repoRoot, `platforms/${platform}/dist`);

    const result = evaluateCodeSplit(distDir, {
      distDir,
      maxEntryKb: budget.maxEntryKb,
      minChunks: budget.minChunks,
    });

    const entryStr = result.entryKb != null ? `${result.entryKb.toFixed(1)} KB` : 'MISSING';
    console.log(
      `  ${result.pass ? '✓' : '✗'} ${platform}: entry=${entryStr}, ` +
        `chunks=${result.chunkCount}, budget=entry≤${budget.maxEntryKb}KB, chunks≥${budget.minChunks}`
    );

    if (!result.pass) {
      overallPass = false;
      failures.push({ platform, failures: result.failures });
    }
  }

  if (overallPass) {
    console.log('─'.repeat(60));
    console.log('[code-split] PASS — code splitting in effect on all platforms');
    process.exit(0);
  } else {
    console.log('─'.repeat(60));
    console.error('[code-split] FAIL:');
    for (const f of failures) {
      for (const reason of f.failures) {
        console.error(`  ✗ ${f.platform}: ${reason}`);
      }
    }
    console.error('\nAdd dynamic imports for heavy screens so Vite emits lazy chunks.');
    process.exit(1);
  }
}

main();
