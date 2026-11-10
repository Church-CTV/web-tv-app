/**
 * Unit tests for scripts/check-css-bundled.mjs.
 *
 * The helper reads built dist/index.html and asserts each platform bundles a
 * hashed CSS asset referenced by the HTML. We test the pure extraction and the
 * verify logic against a temp fixture so we don't require a real build to run.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cssHrefFromHtml, verifyPlatform, REQUIRED_SELECTORS } from './check-css-bundled.mjs';

describe('cssHrefFromHtml', () => {
  it('extracts the stylesheet href', () => {
    const html = `
      <html><head>
        <script src="/assets/index.js"></script>
        <link rel="stylesheet" href="/assets/index.abc123.css">
      </head></html>`;
    expect(cssHrefFromHtml(html)).toBe('/assets/index.abc123.css');
  });

  it('handles unquoted and reordered attributes', () => {
    const html = `<link rel="stylesheet" href="/a/b.css" crossorigin>`;
    expect(cssHrefFromHtml(html)).toBe('/a/b.css');
  });

  it('returns null when no stylesheet present', () => {
    expect(cssHrefFromHtml('<html><head></head></html>')).toBeNull();
  });
});

describe('verifyPlatform', () => {
  function makeFixtures(name, { withCss, withLink }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `css-${name}-`));
    const dir = path.join(root, 'platforms', name, 'dist');
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    const htmlPath = path.join(dir, 'index.html');
    let html = '<html><head>';
    if (withLink) html += '<link rel="stylesheet" href="/assets/index.abc123.css">';
    html += '</head><body></body></html>';
    fs.writeFileSync(htmlPath, html);
    if (withCss) {
      // A sheet that carries every rule the gate requires, so the fixture models a
      // build that produced the shipped UI rather than an arbitrary stylesheet.
      const sheet = 'body{}' + REQUIRED_SELECTORS.map((sel) => `${sel}{}`).join('');
      fs.writeFileSync(path.join(dir, 'assets', 'index.abc123.css'), sheet);
    }
    return root;
  }

  it('passes when CSS is referenced and present', () => {
    const root = makeFixtures('ok', { withCss: true, withLink: true });
    try {
      const r = verifyPlatform(root, 'ok');
      expect(r.ok).toBe(true);
      expect(r.href).toBe('/assets/index.abc123.css');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when dist/index.html is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'css-empty-'));
    try {
      const r = verifyPlatform(root, 'ok');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/missing/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when no stylesheet link in html', () => {
    const root = makeFixtures('nolink', { withCss: true, withLink: false });
    try {
      const r = verifyPlatform(root, 'nolink');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/no stylesheet/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when referenced CSS is missing from dist', () => {
    const root = makeFixtures('nocss', { withCss: false, withLink: true });
    try {
      const r = verifyPlatform(root, 'nocss');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/not in dist/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when a rule the shipped UI needs is absent from the bundled sheet', () => {
    // The unit suites read platforms/<p>/src/styles.css, so they stay green when a rule
    // exists in source but never reaches the built stylesheet. A lost @import, a changed
    // build config or an aggressive minifier then ships an app whose stall row, error
    // dialog or focus carrier paints nothing on a real set - and only this gate, which
    // reads the artifact the package actually contains, can see it.
    const root = makeFixtures('missingrule', { withCss: true, withLink: true });
    try {
      const sheet = path.join(
        root,
        'platforms',
        'missingrule',
        'dist',
        'assets',
        'index.abc123.css'
      );
      fs.writeFileSync(sheet, '.error-dialog{}.error-dialog__button{}.content-card__poster-img{}');
      const r = verifyPlatform(root, 'missingrule');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/\.video-buffering/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('names every missing rule in one pass rather than stopping at the first', () => {
    const root = makeFixtures('partialrules', { withCss: true, withLink: true });
    try {
      const sheet = path.join(
        root,
        'platforms',
        'partialrules',
        'dist',
        'assets',
        'index.abc123.css'
      );
      fs.writeFileSync(sheet, '.error-dialog{}');
      const r = verifyPlatform(root, 'partialrules');
      expect(r.ok).toBe(false);
      for (const sel of REQUIRED_SELECTORS.filter((s) => s !== '.error-dialog')) {
        expect(r.error, `"${sel}" should be listed as missing`).toContain(sel);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
