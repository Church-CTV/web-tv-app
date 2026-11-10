/**
 * CSP helper tests (C1 — Content-Security-Policy on all three index.html).
 *
 * TDD: these define the contract for shared/csp.mjs. Each platform gets a
 * strict CSP. The LG webOSTV.js SDK is vendored locally under
 * platforms/webos/vendor/ (C7), so it is same-origin and covered by
 * `script-src 'self'` — no CDN origin is allowed on any platform. The Vite
 * plugin must inject the policy in BUILD mode only (dev/serve mode stays
 * CSP-free so Vite HMR keeps working).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getCspDirectives,
  buildCspMetaTag,
  getReferrerPolicyMetaTag,
  injectCsp,
  cspPlugin,
} from '../shared/csp.mjs';

describe('getCspDirectives', () => {
  it('webos: strict base CSP', () => {
    const d = getCspDirectives('webos');
    expect(d).toContain("default-src 'self'");
    expect(d).toContain("script-src 'self'");
    expect(d).toContain("object-src 'none'");
    expect(d).toContain("base-uri 'self'");
  });

  it('tizen: strict base CSP', () => {
    const d = getCspDirectives('tizen');
    expect(d).toContain("default-src 'self'");
    expect(d).toContain("script-src 'self'");
    expect(d).toContain("object-src 'none'");
    expect(d).toContain("base-uri 'self'");
  });

  it('vizio: strict base CSP', () => {
    const d = getCspDirectives('vizio');
    expect(d).toContain("default-src 'self'");
    expect(d).toContain("script-src 'self'");
    expect(d).toContain("object-src 'none'");
    expect(d).toContain("base-uri 'self'");
  });

  it('no platform allows the LG SDK CDN origin (vendored instead)', () => {
    for (const p of ['webos', 'tizen', 'vizio']) {
      const d = getCspDirectives(p).join(' ');
      expect(d).not.toContain('webostv.developer.lge.com');
      expect(d).not.toContain('developer.lge.com');
    }
  });

  it('all: media-src and img-src allow https (remote feed/stream hosts)', () => {
    for (const p of ['webos', 'tizen', 'vizio']) {
      const d = getCspDirectives(p).join(' ');
      expect(d).toMatch(/media-src.*https/);
      expect(d).toMatch(/img-src.*https/);
    }
  });

  it('all: style-src allows unsafe-inline for CSSOM writes (element.style.X = Y)', () => {
    // Regression: the app sets 50+ inline style properties at runtime for video
    // scrubbing, program guide layout, and card focus rings. Strict style-src
    // 'self' blocked all of these in Chrome 149+, breaking video playback.
    for (const p of ['webos', 'tizen', 'vizio']) {
      const d = getCspDirectives(p).join('; ');
      expect(d).toContain("style-src 'self' 'unsafe-inline'");
    }
  });

  it('all: connect-src uses quoted self (Chrome 149+ treats unquoted bare self as a literal host)', () => {
    for (const p of ['webos', 'tizen', 'vizio']) {
      const d = getCspDirectives(p).join('; ');
      // Regression: unquoted `connect-src self https:` blocked same-origin XHR/fetch
      // in Chrome 149/151, breaking all app network calls in production bundles.
      // See scripts/csp-debug14.mjs for a live repro.
      expect(d).toContain("connect-src 'self' https:");
      // No unquoted bare self token anywhere in the policy.
      expect(d).not.toMatch(/connect-src\s+[^'"]+self\b/);
    }
  });
});

describe('buildCspMetaTag', () => {
  it('returns a CSP meta tag joining all directives', () => {
    const tag = buildCspMetaTag('webos');
    expect(tag).toContain('http-equiv="Content-Security-Policy"');
    expect(tag).toContain('default-src');
  });
});

describe('getReferrerPolicyMetaTag', () => {
  it('returns a referrer meta tag', () => {
    const tag = getReferrerPolicyMetaTag();
    expect(tag).toContain('name="referrer"');
    expect(tag).toContain('content="');
  });
});

describe('injectCsp', () => {
  const html = '<html><head><title>x</title></head><body></body></html>';

  it('injects the policy before </head>', () => {
    const out = injectCsp(html, 'webos');
    expect(out).toContain('Content-Security-Policy');
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('</head>'));
  });

  it('does not duplicate on second call', () => {
    const once = injectCsp(html, 'tizen');
    const twice = injectCsp(once, 'tizen');
    expect((twice.match(/Content-Security-Policy/g) || []).length).toBe(1);
  });
});

describe('cspPlugin', () => {
  const html = '<html><head><title>x</title></head><body></body></html>';
  const plugin = cspPlugin('webos');

  it('has a name, apply=build, and transformIndexHtml', () => {
    expect(plugin.name).toBeTruthy();
    expect(plugin.apply).toBe('build');
    expect(typeof plugin.transformIndexHtml).toBe('function');
  });

  it('injects in build mode', () => {
    const out = plugin.transformIndexHtml(html, { command: 'build' });
    expect(out).toContain('Content-Security-Policy');
  });

  it('does NOT inject in serve/dev mode (keeps Vite HMR working)', () => {
    const out = plugin.transformIndexHtml(html, { command: 'serve' });
    expect(out).not.toContain('Content-Security-Policy');
    expect(out).toEqual(html);
  });
});

describe('CSP in built dist (after npm run build)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const distExists = (p) =>
    fs.existsSync(path.join(repoRoot, 'platforms', p, 'dist', 'index.html'));
  const anyDist = ['webos', 'tizen', 'vizio'].some(distExists);

  // Only meaningful once `npm run build` has produced dist/ output. In CI the
  // unit-test job runs before build; these run in the post-build steps and on
  // any local checkout that has been built.
  it.skipIf(!anyDist)('webos dist/index.html has CSP meta', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'platforms/webos/dist/index.html'), 'utf-8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'self'");
  });

  it.skipIf(!anyDist)('tizen dist/index.html has CSP meta', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'platforms/tizen/dist/index.html'), 'utf-8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'self'");
  });

  it.skipIf(!anyDist)('vizio dist/index.html has CSP meta', () => {
    const html = fs.readFileSync(path.join(repoRoot, 'platforms/vizio/dist/index.html'), 'utf-8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'self'");
  });

  it.skipIf(!anyDist)('no platform allows the LG SDK CDN origin in its CSP', () => {
    for (const platform of ['webos', 'tizen', 'vizio']) {
      const html = fs.readFileSync(
        path.join(repoRoot, 'platforms', platform, 'dist', 'index.html'),
        'utf-8'
      );
      expect(html).not.toContain('webostv.developer.lge.com');
    }
  });
});
