/**
 * Unit tests for scripts/check-focus-selectors.mjs.
 *
 * Why the gate exists: three separate audit findings were "the docs say focus is
 * handled" while the CSS relied on `:focus-visible` alone. webOS's own stylesheet
 * says its Chromium build does not fire `:focus-visible` for remote/keyboard-free
 * focus, so a rule that only matches `:focus-visible` never paints a ring for a
 * viewer using a D-pad. The same class of claim appeared for Vizio. This gate
 * turns the claim into an enforced rule.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  scanFocusSelectors,
  auditFocusSelectors,
  PLATFORM_STYLESHEETS,
} from './check-focus-selectors.mjs';

describe('scanFocusSelectors', () => {
  it('flags a :focus-visible rule with no :focus partner', () => {
    const css = '.error-dialog__button:focus-visible {\n  outline: 3px solid #fff;\n}\n';
    const v = scanFocusSelectors(css);
    expect(v.length).toBe(1);
    expect(v[0].selector).toBe('.error-dialog__button:focus-visible');
    expect(v[0].line).toBe(1);
    expect(v[0].expectedPartner).toBe('.error-dialog__button:focus');
  });

  it('does not glue a block-less at-rule statement onto the next selector', () => {
    // An @import ends with ';' and has no block, so the text before the next '{'
    // starts with a statement, not a selector. Treating it as selector text makes
    // the partner comparison miss an already-paired rule and the gate cries wolf.
    const css =
      '@import "../../shared/styles/cards.css";\n' +
      '\n' +
      '.content-card:focus,\n.content-card:focus-visible {\n  outline: 3px solid #fff;\n}\n';
    expect(scanFocusSelectors(css)).toEqual([]);
  });

  it('still flags an unpaired rule that follows @import, at its own line', () => {
    const css =
      '@import "shared/cards.css";\n' +
      '@charset "utf-8";\n' +
      '.card:focus-visible {\n  outline: 3px solid #fff;\n}\n';
    const v = scanFocusSelectors(css);
    expect(v.length).toBe(1);
    expect(v[0].selector).toBe('.card:focus-visible');
    expect(v[0].line).toBe(3);
  });

  it('flags an uppercase :FOCUS-VISIBLE, because CSS pseudo-classes are case-insensitive', () => {
    // `:FOCUS-VISIBLE` matches exactly like `:focus-visible`, so an all-caps rule
    // carries the same "never paints on a remote" risk and must not slip through.
    const v = scanFocusSelectors('.other:FOCUS-VISIBLE {\n  outline: 3px solid #fff;\n}\n');
    expect(v.length).toBe(1);
    expect(v[0].expectedPartner).toBe('.other:focus');
  });

  it('accepts a partner written in a different letter case', () => {
    const css = '.other:focus,\n.other:FOCUS-VISIBLE {\n  outline: 3px solid #fff;\n}\n';
    expect(scanFocusSelectors(css)).toEqual([]);
  });

  it('still flags a selector that carries @ inside an attribute selector', () => {
    const v = scanFocusSelectors('a[href="@x"]:focus-visible {\n  outline: 3px solid #fff;\n}\n');
    expect(v.length).toBe(1);
  });

  it('accepts a rule that lists the :focus partner beside :focus-visible', () => {
    const css = ['.a:focus,', '.a:focus-visible {', '  outline: 3px solid #fff;', '}'].join('\n');
    expect(scanFocusSelectors(css)).toEqual([]);
  });

  it('ignores rules that never mention :focus-visible', () => {
    const css = [
      '.card:hover,',
      '.card:focus {',
      '  outline: 3px solid #fff;',
      '}',
      '',
      '@media (x) {',
      '  .b:focus { color: red; }',
      '}',
    ].join('\n');
    expect(scanFocusSelectors(css)).toEqual([]);
  });

  it('flags only the unpaired selector when a rule lists several', () => {
    const css = [
      '.a:focus,',
      '.a:focus-visible,',
      '.b:focus-visible {',
      '  outline: none;',
      '}',
    ].join('\n');
    const v = scanFocusSelectors(css);
    expect(v.length).toBe(1);
    expect(v[0].selector).toBe('.b:focus-visible');
    expect(v[0].line).toBe(3);
  });

  it('flags :focus-visible inside a media query with its real line number', () => {
    const css = [
      '@media (prefers-reduced-motion: reduce) {',
      '  /* motion off */',
      '  .btn:focus-visible {',
      '    outline: 2px solid red;',
      '  }',
      '}',
    ].join('\n');
    const v = scanFocusSelectors(css);
    expect(v.length).toBe(1);
    expect(v[0].line).toBe(3);
  });

  it('does not count :focus-visible mentioned inside a comment', () => {
    const css = [
      '/* Use .btn:focus-visible only with a :focus partner. */',
      '.btn:focus {',
      '  outline: 2px solid red;',
      '}',
    ].join('\n');
    expect(scanFocusSelectors(css)).toEqual([]);
  });

  it('distinguishes :focus-within and :focus-visible as separate pseudo-classes', () => {
    // :focus-within is a different trigger; it must not satisfy the partner check
    // for a :focus-visible selector, and vice versa.
    const css =
      '.card:focus-within .poster,\n.card:focus-visible .poster {\n  outline: 3px solid #fff;\n}\n';
    const v = scanFocusSelectors(css);
    expect(v.length).toBe(1);
    expect(v[0].expectedPartner).toBe('.card:focus .poster');
  });
});

describe('auditFocusSelectors', () => {
  it('reports violations per file, with the file path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-gate-'));
    try {
      fs.writeFileSync(path.join(dir, 'bad.css'), '.x:focus-visible { outline: 3px solid red; }\n');
      fs.writeFileSync(
        path.join(dir, 'good.css'),
        '.x:focus,\n.x:focus-visible { outline: 3px solid red; }\n'
      );
      const results = auditFocusSelectors([dir]);
      const byFile = Object.fromEntries(results.map((r) => [path.basename(r.file), r.violations]));
      expect(byFile['bad.css'].length).toBe(1);
      expect(byFile['good.css']).toEqual([]);
      expect(byFile['bad.css'][0].file).toContain('bad.css');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scans every platform stylesheet plus the shared dialog styles', () => {
    // The list is the audit surface. A new platform stylesheet must be added to
    // it, otherwise its focus rules go unenforced.
    expect(PLATFORM_STYLESHEETS.length).toBeGreaterThanOrEqual(5);
    for (const rel of PLATFORM_STYLESHEETS) {
      // Run from the repo root: CI runs the root vitest suite (ci.yml "root" step).
      expect(fs.existsSync(path.resolve(process.cwd(), rel)), `missing ${rel}`).toBe(true);
      expect(rel).toMatch(/\.css$/);
    }
  });

  it('the repository CSS it scans has no unpaired :focus-visible rule', () => {
    // Regression lock: this passed on the commit that added the gate, so a later
    // "docs say focus works" claim that skips the :focus partner fails CI here.
    const results = auditFocusSelectors();
    const flat = results.flatMap((r) => r.violations);
    expect(flat.map((v) => `${v.file}:${v.line} ${v.selector}`)).toEqual([]);
  });
});

describe('scanFocusSelectors pairing inside functional pseudo-classes', () => {
  it('accepts a :focus partner written inside :where()', () => {
    // The zero-specificity fallback shape: one rule, both pseudo-classes.
    expect(
      scanFocusSelectors(':where(*:focus, *:focus-visible) { outline: 3px solid red; }')
    ).toEqual([]);
  });

  it('accepts a partner inside :is() for a descendant shape', () => {
    expect(
      scanFocusSelectors(':is(.a:focus, .b:focus-visible) .row { outline: 3px solid red; }')
    ).toEqual([]);
  });

  it('still flags :focus-visible wrapped on its own', () => {
    const v = scanFocusSelectors(':where(*:focus-visible) { outline: 3px solid red; }');
    expect(v.map((x) => x.selector)).toEqual([':where(*:focus-visible)']);
  });

  it('reads a partner through a nested wrapper instead of stopping at the first paren', () => {
    // The shipped fallback shape only moved one level: `[^()]*` cannot cross the
    // parens of :not(), so a correct rule was reported as a violation.
    expect(
      scanFocusSelectors(':is(:not(:focus-visible), *:focus) { outline: 3px solid red; }')
    ).toEqual([]);
    expect(
      scanFocusSelectors(':where(*:is(:focus), *:focus-visible) { outline: 3px solid red; }')
    ).toEqual([]);
  });

  it('does not count a negated pseudo as a partner', () => {
    // :not(:focus-visible) is true for everything that is NOT focus-visible, so it is
    // not a focus trigger that can stand in for the missing :focus selector.
    const v = scanFocusSelectors(
      ':where(:not(:focus-visible), *:focus-visible) { outline: 3px solid red; }'
    );
    expect(v.map((x) => x.selector)).toEqual([':where(:not(:focus-visible), *:focus-visible)']);
  });

  it('does not let :focus-within stand in for the :focus partner', () => {
    const v = scanFocusSelectors(
      ':where(*:focus-visible, *:focus-within) { outline: 3px solid red; }'
    );
    expect(v.length).toBe(1);
  });
});
