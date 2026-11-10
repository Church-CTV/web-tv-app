#!/usr/bin/env node
/**
 * Design tokens gate (K1a).
 *
 * Ensures shared/styles/*.css (excluding tokens.css itself) uses only
 * design token variables for colors, not hardcoded hex values.
 *
 * Hardcoded hex colors bypass the design system and drift across platforms.
 * tokens.css is the single source of truth for all color values.
 *
 * Usage:
 *   node scripts/check-design-tokens.mjs
 *
 * Exits 1 if any hardcoded hex color is found in shared/styles/*.css
 * (excluding tokens.css).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Matches hex color values: #RGB (3 chars) or #RRGGBB (6 chars).
 * Case-insensitive.
 */
const HEX_COLOR_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

/**
 * Scan CSS source for hardcoded hex colors, ignoring CSS comments.
 *
 * @param {string} css - CSS source code
 * @returns {Array<{value: string, line: number}>} list of violations
 */
export function scanHardcodedColors(css) {
  const lines = css.split('\n');
  const violations = [];
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Strip comment content from this line
    let cleaned = '';
    let j = 0;
    while (j < line.length) {
      if (inComment) {
        const closeIdx = line.indexOf('*/', j);
        if (closeIdx === -1) {
          // Comment continues to next line
          j = line.length;
        } else {
          inComment = false;
          j = closeIdx + 2;
          cleaned += line.slice(j);
        }
      } else {
        const openIdx = line.indexOf('/*', j);
        if (openIdx === -1) {
          cleaned += line.slice(j);
          j = line.length;
        } else {
          cleaned += line.slice(j, openIdx);
          inComment = true;
          j = openIdx + 2;
        }
      }
    }

    // Scan cleaned line for hex colors
    HEX_COLOR_RE.lastIndex = 0;
    let m;
    while ((m = HEX_COLOR_RE.exec(cleaned)) !== null) {
      violations.push({ value: m[0], line: i + 1 });
    }
  }

  return violations;
}

/**
 * Audit all CSS files in shared/styles/ for hardcoded colors.
 * tokens.css is excluded (it is the source of truth).
 *
 * @param {string} root - repo root directory
 * @returns {Array<{file: string, violations: Array<{value: string, line: number}>}>}
 */
export function auditDesignTokens(root) {
  const stylesDir = path.join(root, 'shared', 'styles');
  if (!fs.existsSync(stylesDir)) return [];

  const files = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css'));
  const results = [];

  for (const file of files) {
    if (file === 'tokens.css') continue; // tokens.css is allowed to have hex colors
    const content = fs.readFileSync(path.join(stylesDir, file), 'utf8');
    const violations = scanHardcodedColors(content);
    results.push({ file, violations });
  }

  return results;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const results = auditDesignTokens(repoRoot);
  let hasViolations = false;

  for (const r of results) {
    if (r.violations.length > 0) {
      hasViolations = true;
      console.error(`[design-tokens] ${r.file}: ${r.violations.length} hardcoded color(s)`);
      for (const v of r.violations) {
        console.error(`[design-tokens]   line ${v.line}: ${v.value}`);
      }
    }
  }

  if (hasViolations) {
    console.error(
      '\n[design-tokens] FAIL: hardcoded hex colors found. Use var(--color-*) tokens from shared/styles/tokens.css.'
    );
    process.exit(1);
  }

  console.log('[design-tokens] OK: all colors use design tokens');
  process.exit(0);
}
