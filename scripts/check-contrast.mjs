#!/usr/bin/env node
/**
 * Contrast audit script — verifies all design tokens meet WCAG 2.1 AA.
 *
 * WCAG 2.1 AA requirements:
 *   - Normal text (< 18pt / 24px): contrast ratio >= 4.5:1
 *   - Large text (>= 18pt / 24px or >= 14pt bold): contrast ratio >= 3.0:1
 *   - Non-text UI components (borders, focus rings): contrast ratio >= 3.0:1
 *
 * Usage: node scripts/check-contrast.mjs
 * Exit code 0 = all tokens pass; exit code 1 = violations found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_PATH = path.join(__dirname, '..', 'shared', 'styles', 'tokens.css');

/**
 * Parse a hex color string to [r, g, b] (0-255).
 */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Compute relative luminance per WCAG 2.1 definition.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const ch = c / 255;
    return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute contrast ratio between two colors.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(colorA, colorB) {
  const lumA = relativeLuminance(hexToRgb(colorA));
  const lumB = relativeLuminance(hexToRgb(colorB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse CSS custom properties from a CSS file.
 */
export function parseTokensCss(cssContent) {
  const tokens = {};
  const re = /--color-([\w-]+):\s*(#[0-9a-fA-F]{6});/g;
  let match;
  while ((match = re.exec(cssContent)) !== null) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

/**
 * Read and parse tokens.css.
 */
export function loadTokens() {
  const content = fs.readFileSync(TOKENS_PATH, 'utf-8');
  return parseTokensCss(content);
}

/**
 * Define the contrast pairs to check.
 * Each pair is: [foregroundToken, backgroundToken, context, minRatio]
 * minRatio: 4.5 for normal text, 3.0 for large text / UI components.
 *
 * Note: button text on accent/error/success backgrounds uses --color-black
 * (dark text on colored button backgrounds is the WCAG-compliant pattern).
 */
export function getContrastPairs() {
  return [
    // Text colors on backgrounds — normal text (4.5:1 required)
    { fg: 'text-primary', bg: 'background', context: 'primary text on background', min: 4.5 },
    { fg: 'text-secondary', bg: 'background', context: 'secondary text on background', min: 4.5 },
    { fg: 'text-primary', bg: 'surface', context: 'primary text on surface', min: 4.5 },
    { fg: 'text-secondary', bg: 'surface', context: 'secondary text on surface', min: 4.5 },

    // Button/badge white text on colored backgrounds — normal text (4.5:1 required)
    // accent/error/success are the button background colors (darker shades)
    { fg: 'text-primary', bg: 'accent', context: 'button text on accent bg', min: 4.5 },
    { fg: 'text-primary', bg: 'accent-hover', context: 'button text on accent-hover bg', min: 4.5 },
    { fg: 'text-primary', bg: 'error', context: 'button text on error bg', min: 4.5 },
    { fg: 'text-primary', bg: 'success', context: 'badge text on success bg', min: 4.5 },

    // Colored text tokens on dark backgrounds — normal text (4.5:1 required)
    // error-text/success-text are the readable text colors (lighter shades)
    { fg: 'error-text', bg: 'background', context: 'error text on background', min: 4.5 },
    { fg: 'success-text', bg: 'background', context: 'success text on background', min: 4.5 },
    { fg: 'error-text', bg: 'surface', context: 'error text on surface', min: 4.5 },
    { fg: 'success-text', bg: 'surface', context: 'success text on surface', min: 4.5 },

    // UI component borders/focus — 3.0:1 required
    { fg: 'focus', bg: 'background', context: 'focus ring on background', min: 3.0 },
    // The ring that content cards actually paint is --color-card-focus (a white
    // poster outline), a separate token from the red --color-focus above. Without
    // these two pairs the shipped card ring is the one focus colour in the design
    // system that no gate measures, so dimming it to near-invisibility would still
    // pass every check (F100's failure class). This gate covers the app-chrome side
    // of the ring; contrast against a bright video frame cannot be token-measured
    // and stays the job of the painted E2E probe (tests/e2e/production).
    { fg: 'card-focus', bg: 'background', context: 'card poster ring on background', min: 3.0 },
    { fg: 'card-focus', bg: 'surface', context: 'card poster ring on surface', min: 3.0 },
    { fg: 'accent', bg: 'background', context: 'accent UI on background', min: 3.0 },
    { fg: 'error', bg: 'background', context: 'error border on background', min: 3.0 },
    // The red ring does not only paint on the page background. Three shared rules
    // swap the element's own background to --color-surface-hover in the same
    // declaration that draws the ring (components.css:327, :378, :459 — left nav,
    // settings option, continue-watching row), so the surface it is measured against
    // is the hover surface, not the page. Measured against the shipped tokens the
    // hover pair was 2.66:1, under this script's own 3.0:1 non-text rule, while the
    // gate stayed green because only --color-background was in the pair list.
    { fg: 'focus', bg: 'surface', context: 'focus ring on surface', min: 3.0 },
    {
      fg: 'focus',
      bg: 'surface-hover',
      context: 'focus ring on the hover surface it paints over',
      min: 3.0,
    },
    {
      fg: 'text-primary',
      bg: 'surface-hover',
      context: 'label on the hover surface',
      min: 4.5,
    },
    // --color-focus doubles as a button fill (error-dialog button, watch-later
    // button). WCAG 1.4.11 measures the ring at 3:1 while the label on that fill is
    // text and needs 4.5:1, so the ring colour may not be lightened for the ring
    // without re-checking the label. The pair pins which way that trade goes: dark
    // label on the coloured fill, the pattern this file already documents for
    // accent/error/success buttons.
    {
      fg: 'black',
      bg: 'focus',
      context: 'dark button label on the focus-coloured fill',
      min: 4.5,
    },
  ];
}

/**
 * Run contrast audit and return results.
 */
export function auditContrast(tokens, pairs = getContrastPairs()) {
  const results = [];
  for (const pair of pairs) {
    const fgColor = tokens[pair.fg];
    const bgColor = tokens[pair.bg];
    if (!fgColor || !bgColor) {
      results.push({
        ...pair,
        fgColor: fgColor ?? 'MISSING',
        bgColor: bgColor ?? 'MISSING',
        ratio: 0,
        pass: false,
        error: 'Missing token',
      });
      continue;
    }
    const ratio = contrastRatio(fgColor, bgColor);
    results.push({
      ...pair,
      fgColor,
      bgColor,
      ratio: Math.round(ratio * 100) / 100,
      pass: ratio >= pair.min,
    });
  }
  return results;
}

/**
 * Main — run audit and print results.
 */
function main() {
  const tokens = loadTokens();
  const results = auditContrast(tokens);
  const failures = results.filter((r) => !r.pass);

  console.log('Contrast audit (WCAG 2.1 AA):\n');
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    const icon = r.pass ? '✓' : '✗';
    console.log(
      `  ${icon} [${status}] ${r.context}: ${r.ratio.toFixed(2)}:1 (required ${r.min}:1)`
    );
  }
  console.log('');

  if (failures.length > 0) {
    console.log(`❌ ${failures.length} contrast violation(s) found:\n`);
    for (const f of failures) {
      console.log(`  • ${f.context}: ${f.ratio.toFixed(2)}:1 < ${f.min}:1`);
    }
    process.exit(1);
  }

  console.log('✅ All contrast checks pass.');
  process.exit(0);
}

// Run only when invoked directly
if (process.argv[1] === __filename) {
  main();
}
