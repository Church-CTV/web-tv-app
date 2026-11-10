#!/usr/bin/env node
/**
 * I18n Integrity Gate (K5a).
 *
 * Verifies that the TranslationKey union in core/src/i18n/I18n.ts and the EN/ES
 * dictionaries are all in sync. Fails CI when:
 *   - A key is in the union but missing from EN or ES (missing translation)
 *   - A key is in EN or ES but not in the union (extra key, type error)
 *   - EN and ES have different key sets (one locale missing a key the other has)
 *   - A dictionary has duplicate keys
 *
 * Usage:
 *   node scripts/check-i18n-integrity.mjs
 *
 * Exit 0 = all checks pass.
 * Exit 1 = integrity violations found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const I18N_PATH = path.join(REPO_ROOT, 'core', 'src', 'i18n', 'I18n.ts');

/**
 * Extract all keys from the TranslationKey union type block.
 *
 * Matches lines like:
 *   | 'nav.home'
 *   | 'back'
 *
 * @param {string} src - Full I18n.ts source
 * @returns {string[]} keys in order of appearance
 */
export function extractTranslationKeys(src) {
  // Find the union block: from "export type TranslationKey" to the closing semicolon
  const unionMatch = src.match(/export type TranslationKey =[\s\S]*?;/);
  if (!unionMatch) return [];

  const block = unionMatch[0];
  const keys = [];
  const re = /\|\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)*)'/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Extract all keys from a specific dictionary constant (EN or ES).
 *
 * Matches the pattern:
 *   export const EN: LocaleDict = {
 *     'key': 'value',
 *     ...
 *   };
 *
 * @param {string} src - Full I18n.ts source
 * @param {string} dictName - 'EN' or 'ES'
 * @returns {string[]} keys in order of appearance
 */
export function extractDictKeys(src, dictName) {
  // Match from "export const EN: LocaleDict = {" to the closing "};"}
  const pattern = new RegExp(
    `export const ${dictName}:\\s*LocaleDict\\s*=\\s*\\{([\\s\\S]*?)\\};`,
    'm'
  );
  const match = src.match(pattern);
  if (!match) return [];

  const block = match[1];
  const keys = [];
  // Match key lines: either 'key': or key: (unquoted, single word keys like back)
  const keyRe = /(?:^|\n)\s*(?:'([a-z0-9_]+(?:\.[a-z0-9_]+)*)'|([a-z_]+))\s*:/gm;
  let m;
  while ((m = keyRe.exec(block)) !== null) {
    const key = m[1] ?? m[2];
    keys.push(key);
  }
  return keys;
}

/**
 * Check i18n integrity and return a report.
 *
 * @param {string} src - Full I18n.ts source
 * @returns {{pass: boolean, errors: string[], unionKeys: number, enKeys: number, esKeys: number}}
 */
export function checkI18nIntegrity(src) {
  const unionKeys = extractTranslationKeys(src);
  const enKeys = extractDictKeys(src, 'EN');
  const esKeys = extractDictKeys(src, 'ES');

  const errors = [];
  const unionSet = new Set(unionKeys);
  const enSet = new Set(enKeys);
  const esSet = new Set(esKeys);

  // 1. Keys in union but missing from EN
  for (const key of unionKeys) {
    if (!enSet.has(key)) {
      errors.push(`[missing-en] '${key}' is in TranslationKey union but not in EN dictionary`);
    }
  }

  // 2. Keys in union but missing from ES
  for (const key of unionKeys) {
    if (!esSet.has(key)) {
      errors.push(`[missing-es] '${key}' is in TranslationKey union but not in ES dictionary`);
    }
  }

  // 3. Keys in EN but not in union (extra keys)
  for (const key of enKeys) {
    if (!unionSet.has(key)) {
      errors.push(`[extra-en] '${key}' is in EN dictionary but not in TranslationKey union`);
    }
  }

  // 4. Keys in ES but not in union (extra keys)
  for (const key of esKeys) {
    if (!unionSet.has(key)) {
      errors.push(`[extra-es] '${key}' is in ES dictionary but not in TranslationKey union`);
    }
  }

  // 5. EN has key that ES doesn't (direct parity check)
  for (const key of enKeys) {
    if (!esSet.has(key)) {
      errors.push(`[en-es-mismatch] '${key}' exists in EN but not in ES`);
    }
  }

  // 6. ES has key that EN doesn't (direct parity check)
  for (const key of esKeys) {
    if (!enSet.has(key)) {
      errors.push(`[en-es-mismatch] '${key}' exists in ES but not in EN`);
    }
  }

  // 7. Duplicate keys in EN
  {
    const seen = new Map();
    for (const key of enKeys) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) {
        errors.push(`[duplicate-en] '${key}' appears ${count} times in EN dictionary`);
      }
    }
  }

  // 8. Duplicate keys in ES
  {
    const seen = new Map();
    for (const key of esKeys) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) {
        errors.push(`[duplicate-es] '${key}' appears ${count} times in ES dictionary`);
      }
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    unionKeys: unionKeys.length,
    enKeys: enKeys.length,
    esKeys: esKeys.length,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1]);

if (isMain) {
  if (!fs.existsSync(I18N_PATH)) {
    console.error(`[i18n-integrity] ERROR: ${I18N_PATH} not found`);
    process.exit(1);
  }

  const src = fs.readFileSync(I18N_PATH, 'utf8');
  const result = checkI18nIntegrity(src);

  console.log(`[i18n-integrity] TranslationKey union: ${result.unionKeys} keys`);
  console.log(`[i18n-integrity] EN dictionary:        ${result.enKeys} keys`);
  console.log(`[i18n-integrity] ES dictionary:        ${result.esKeys} keys`);

  if (result.pass) {
    console.log('[i18n-integrity] PASS: all dictionaries are in sync.');
    process.exit(0);
  }

  console.error(`\n[i18n-integrity] FAIL: ${result.errors.length} violation(s):`);
  for (const err of result.errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
}
