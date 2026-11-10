/**
 * Unit tests for scripts/check-design-tokens.mjs.
 *
 * The gate scans shared/styles/*.css (excluding tokens.css) for hardcoded
 * hex colors that should use design tokens instead.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanHardcodedColors, auditDesignTokens } from './check-design-tokens.mjs';

describe('scanHardcodedColors', () => {
  it('finds a hex color in CSS', () => {
    const css = '.foo { background: #d63d56; }';
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(1);
    expect(results[0].value).toBe('#d63d56');
    expect(results[0].line).toBe(1);
  });

  it('finds all hex colors across multiple lines', () => {
    const css = [
      '.a { background: #000; }',
      '.b { color: #FF0000; }',
      '.c { border-color: var(--color-accent); }',
    ].join('\n');
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.value)).toEqual(['#000', '#FF0000']);
  });

  it('ignores var() references and non-color properties', () => {
    const css = [
      '.a { background: var(--color-surface); }',
      '.b { width: 100px; }',
      '.c { color: transparent; }',
    ].join('\n');
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(0);
  });

  it('ignores colors in comments', () => {
    const css = '/* uses #FF0000 as an example */\n.a { color: var(--color-error); }';
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(0);
  });

  it('handles uppercase hex colors', () => {
    const css = '.foo { color: #AABBCC; }';
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(1);
    expect(results[0].value).toBe('#AABBCC');
  });

  it('handles 3-char and 6-char hex colors', () => {
    const css = ['.a { background: #FFF; }', '.b { color: #123456; }'].join('\n');
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(2);
  });

  it('reports correct line numbers', () => {
    const css = ['/* comment */', '.a { }', '.b { background: #FF0000; }'].join('\n');
    const results = scanHardcodedColors(css);
    expect(results.length).toBe(1);
    expect(results[0].line).toBe(3);
  });
});

describe('auditDesignTokens', () => {
  function makeFixtures(name, files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `tokens-${name}-`));
    const stylesDir = path.join(root, 'shared', 'styles');
    fs.mkdirSync(stylesDir, { recursive: true });
    for (const [fname, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(stylesDir, fname), content);
    }
    return root;
  }

  it('passes when no hardcoded colors exist outside tokens.css', () => {
    const root = makeFixtures('clean', {
      'tokens.css': ':root { --color-accent: #E94560; }',
      'components.css': '.foo { background: var(--color-accent); }',
    });
    try {
      const results = auditDesignTokens(root);
      const violations = results.filter((r) => r.violations.length > 0);
      expect(violations.length).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when hardcoded colors are found in non-token files', () => {
    const root = makeFixtures('dirty', {
      'tokens.css': ':root { --color-accent: #E94560; }',
      'components.css': '.foo { background: #d63d56; }',
      'layout.css': '.bar { color: #FF0000; }',
    });
    try {
      const results = auditDesignTokens(root);
      const violations = results.filter((r) => r.violations.length > 0);
      expect(violations.length).toBe(2);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('excludes tokens.css from the scan', () => {
    const root = makeFixtures('tokens-ok', {
      'tokens.css': ':root { --color-accent: #E94560; }',
      'components.css': '.foo { background: var(--color-accent); }',
    });
    try {
      const results = auditDesignTokens(root);
      const tokensResult = results.find((r) => r.file === 'tokens.css');
      expect(tokensResult).toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('handles missing shared/styles directory gracefully', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokens-missing-'));
    try {
      const results = auditDesignTokens(root);
      expect(results).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports the file path relative to the styles directory', () => {
    const root = makeFixtures('paths', {
      'tokens.css': ':root { --color-x: #FFF; }',
      'components.css': '.a { background: #000; }',
    });
    try {
      const results = auditDesignTokens(root);
      const bad = results.find((r) => r.file === 'components.css');
      expect(bad).toBeDefined();
      expect(bad.violations[0].value).toBe('#000');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
