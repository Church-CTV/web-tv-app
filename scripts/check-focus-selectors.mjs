#!/usr/bin/env node
/**
 * Focus-selector gate.
 *
 * Rule: in the stylesheets the CTV apps ship, every selector that uses
 * `:focus-visible` must be paired, in the same rule's selector list, with the
 * equivalent `:focus` selector.
 *
 * Why: `:focus-visible` is a heuristic that fires for keyboard focus. A TV remote
 * is keyboard-free, and platforms/webos/src/styles.css states in its own comment
 * that the webOS Chromium build does not apply `:focus-visible` for remote focus.
 * So a focus ring written only as `:focus-visible` can exist in the stylesheet,
 * pass review, and never paint for the only viewer who has one. Three audit
 * findings of the form "the docs say focus is handled" traced back to exactly
 * this, which is why the claim is now enforced instead of restated.
 *
 * Usage:
 *   node scripts/check-focus-selectors.mjs [file-or-dir ...]
 *
 * Defaults to PLATFORM_STYLESHEETS. Exits 1 listing every unpaired selector with
 * its file and line.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * The audit surface. Add a stylesheet here when a platform grows a new one, or
 * its focus rules go unenforced (scripts/check-focus-selectors.test.mjs locks
 * the count and the existence of each entry).
 */
export const PLATFORM_STYLESHEETS = [
  'platforms/webos/src/styles.css',
  'platforms/tizen/src/styles.css',
  'platforms/vizio/src/styles.css',
  'shared/styles/components.css',
  'shared/styles/layout.css',
  'shared/styles/error-dialog.css',
  'shared/styles/confirm-dialog.css',
];

const FOCUS_VISIBLE = ':focus-visible';

/** Replace comments with blanks while keeping every character offset intact. */
function blankComments(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let j = i; j < stop; j++) {
        out += css[j] === '\n' ? '\n' : ' ';
      }
      i = stop;
      continue;
    }
    out += css[i];
    i++;
  }
  return out;
}

/**
 * Blank block-less at-rule statements (@import "x.css"; @charset "utf-8";) while
 * keeping every offset intact. Such a statement has no block, so the text before
 * the next rule's brace begins with it; left in place the walker reads it as part
 * of the selector list, which hides an already-paired rule (false positive) and
 * shifts the reported line. An @ that is only reached inside an attribute selector
 * is not a statement, and an at-rule that owns a block (@media, @supports) is left
 * untouched so its children are still descended into.
 */
function blankAtRuleStatements(css) {
  let out = '';
  let depth = 0;
  let lastSignificant = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      out += ch;
      i++;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (
      ch === '@' &&
      depth === 0 &&
      (lastSignificant === '' || lastSignificant === '}' || lastSignificant === ';')
    ) {
      let j = i + 1;
      let quote = null;
      let isStatement = false;
      while (j < css.length) {
        const c = css[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '(') {
          // A url() may legally contain ';', so skip the whole call.
          const close = css.indexOf(')', j + 1);
          if (close === -1) break;
          j = close;
        } else if (c === '[' || c === ']')
          break; // attribute selector, not an at-rule
        else if (c === ';') {
          isStatement = true;
          break;
        } else if (c === '{' || c === '}') break;
        j++;
      }
      if (isStatement) {
        for (let k = i; k <= j; k++) out += css[k] === '\n' ? '\n' : ' ';
        i = j + 1;
        lastSignificant = ';';
        continue;
      }
    }
    lastSignificant = ch;
    out += ch;
    i++;
  }
  return out;
}

/** Split a selector list on top-level commas only (never inside parentheses). */
function splitSelectorList(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Collapse whitespace so an equivalent selector compares equal. */
function normalize(selector) {
  return selector.trim().replace(/\s+/g, ' ');
}

/** The `:focus` selector that must appear beside a `:focus-visible` one. */
function partnerOf(selector) {
  return normalize(selector).replace(FOCUS_VISIBLE_RE, ':focus');
}

/**
 * CSS pseudo-classes are ASCII case-insensitive, so `:FOCUS-VISIBLE` matches
 * exactly like `:focus-visible` and carries the same "no ring on a remote" risk.
 * Compare case-folded so an uppercase spelling cannot slip past the gate.
 */
const FOCUS_VISIBLE_RE = /:focus-visible/gi;

function hasFocusVisible(text) {
  return /:focus-visible/i.test(text);
}

/**
 * Drop the body of every negated functional pseudo-class, innermost first, so a
 * selector like `:is(:not(:focus-visible), *:focus)` reads as what a browser would
 * actually match. `:not(...)` and `:has(...)` are dropped whole: a negation is
 * satisfied by elements that do NOT match it, and `:has(:focus)` reports a
 * descendant's focus, so neither can act as this element's focus trigger.
 * `:where()` and `:is()` keep their contents, because those arguments are matched.
 */
function withoutNegations(selector) {
  let out = selector;
  let prev;
  do {
    prev = out;
    out = out.replace(/:(?:not|has)\s*\([^()]*\)/gi, '');
  } while (out !== prev);
  return out;
}

/**
 * The partner may live inside a functional pseudo-class argument list:
 * `:where(*:focus, *:focus-visible)` applies both pseudo-classes to the same
 * element set, which is the zero-specificity fallback shape. Only a literal
 * `:focus` outside a negation counts - `:focus-within` and `:focus-visible` mean
 * something else and cannot substitute. Nesting is walked by dropping negations,
 * not by stopping at the first parenthesis, so `:is(:not(:focus-visible), *:focus)`
 * is recognised instead of reported.
 */
function selfPaired(selector) {
  const bare = withoutNegations(selector).replace(FOCUS_VISIBLE_RE, '');
  return /:focus(?![-\w])/i.test(bare);
}

function lineAt(css, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < css.length; i++) {
    if (css[i] === '\n') line++;
  }
  return line;
}

/**
 * Walk rules, descending into at-rule blocks (@media, @supports) so nested rules
 * are checked too. Returns violations without a `file` field; the caller adds it.
 */
function walkRules(blankCss, offsetBase, offsets) {
  const violations = [];
  let cursor = 0;

  while (cursor < blankCss.length) {
    const brace = blankCss.indexOf('{', cursor);
    if (brace === -1) break;

    const selectorText = blankCss.slice(cursor, brace);
    // Find the matching close brace.
    let depth = 1;
    let end = brace + 1;
    while (end < blankCss.length && depth > 0) {
      if (blankCss[end] === '{') depth++;
      else if (blankCss[end] === '}') depth--;
      end++;
    }
    const body = blankCss.slice(brace + 1, end - 1);
    const bodyStart = brace + 1;

    if (selectorText.includes('@') && body.includes('{')) {
      // An at-rule wrapper: its children are rules, checked in place.
      violations.push(...walkRules(body, offsetBase + bodyStart, offsets));
    } else if (hasFocusVisible(selectorText)) {
      const selectors = splitSelectorList(selectorText);
      const declared = new Set(selectors.map((s) => normalize(s).toLowerCase()).filter(Boolean));
      let searchFrom = 0;
      for (const raw of selectors) {
        // Pieces keep the whitespace after the previous comma, so the reported
        // line must be where the selector text itself starts, not where its
        // piece starts.
        const pieceStart = selectorText.indexOf(raw, searchFrom);
        searchFrom = pieceStart === -1 ? searchFrom : pieceStart + raw.length;
        const selector = normalize(raw);
        if (!hasFocusVisible(selector)) continue;
        if (declared.has(partnerOf(selector).toLowerCase()) || selfPaired(selector)) continue;
        const lead = raw.length - raw.trimStart().length;
        const selStart = pieceStart === -1 ? 0 : pieceStart + lead;
        violations.push({
          selector,
          expectedPartner: partnerOf(selector),
          line: lineAt(offsets, offsetBase + cursor + selStart),
        });
      }
    }

    cursor = end;
  }

  return violations;
}

/** Scan one stylesheet's text for `:focus-visible` selectors with no `:focus` partner. */
export function scanFocusSelectors(css) {
  return walkRules(blankAtRuleStatements(blankComments(css)), 0, css);
}

/** Expand the audit targets: explicit files/dirs, else PLATFORM_STYLESHEETS. */
function resolveTargets(args) {
  if (!args.length) {
    return PLATFORM_STYLESHEETS.map((rel) => path.resolve(repoRoot, rel));
  }
  const files = [];
  for (const arg of args) {
    const abs = path.resolve(process.cwd(), arg);
    if (!fs.existsSync(abs)) {
      throw new Error(`Path not found: ${arg}`);
    }
    if (fs.statSync(abs).isDirectory()) {
      for (const entry of fs.readdirSync(abs, { recursive: true })) {
        const rel = path.join(abs, entry);
        if (rel.endsWith('.css') && !rel.includes(`${path.sep}dist${path.sep}`)) files.push(rel);
      }
    } else {
      files.push(abs);
    }
  }
  return files;
}

/** Scan targets and return one result per file, violations tagged with file and line. */
export function auditFocusSelectors(targets) {
  const files = resolveTargets(Array.isArray(targets) ? targets : []);
  const results = [];
  for (const file of files) {
    const css = fs.readFileSync(file, 'utf8');
    const violations = scanFocusSelectors(css).map((v) => ({
      ...v,
      file: path.relative(repoRoot, file) || file,
    }));
    results.push({ file: path.relative(repoRoot, file) || file, violations });
  }
  return results;
}

function main() {
  let results;
  try {
    results = auditFocusSelectors(process.argv.slice(2));
  } catch (err) {
    console.error(`[focus-selectors] ${err.message}`);
    process.exit(1);
  }

  let hasViolations = false;
  for (const r of results) {
    if (!r.violations.length) continue;
    hasViolations = true;
    console.error(
      `[focus-selectors] ${r.file}: ${r.violations.length} unpaired :focus-visible selector(s)`
    );
    for (const v of r.violations) {
      console.error(
        `[focus-selectors]   line ${v.line}: ${v.selector} -> add ${v.expectedPartner}`
      );
    }
  }

  if (hasViolations) {
    console.error(
      '\n[focus-selectors] FAIL: a remote is keyboard-free, so :focus-visible alone never paints a focus ring.' +
        '\n  Pair each selector with the equivalent :focus selector in the same rule.'
    );
    process.exit(1);
  }

  console.log(
    `[focus-selectors] OK: ${results.length} stylesheet(s), every :focus-visible has a :focus partner`
  );
  process.exit(0);
}

// Only run the CLI when invoked directly, so the tests can import the functions.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
