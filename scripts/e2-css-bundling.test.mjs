/**
 * E2 — shared CSS must be bundled, not resolved at runtime.
 *
 * Before E2, Tizen and Vizio index.html referenced shared/styles/*.css via
 * runtime <link> tags (Vite printed "doesn't exist at build time" and the
 * packaged apps could ship without CSS). The fix mirrors webOS: each
 * platform's entry point imports src/styles.css, which @imports the shared
 * stylesheets, so Vite/Rollup emits a single hashed CSS asset into dist/
 * and index.html gets a plain link tag pointing at it.
 *
 * These tests assert the wiring is in place at the source level so a
 * regression (someone re-adding runtime link tags) fails CI immediately.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(repoRoot, p));

const SHARED_SHEETS = ['tokens.css', 'layout.css'];

for (const platform of ['webos', 'tizen', 'vizio']) {
  const dir = `platforms/${platform}`;

  describe(`${platform}: shared CSS is bundled, not resolved at runtime`, () => {
    it('src/styles.css imports the shared foundation and shipped component skin', () => {
      expect(exists(`${dir}/src/styles.css`)).toBe(true);
      const css = read(`${dir}/src/styles.css`);
      const skin = platform === 'vizio' ? 'roku-components.css' : 'components.css';
      for (const name of [...SHARED_SHEETS, skin]) {
        expect(exists(`shared/styles/${name}`)).toBe(true);
        expect(css).toContain(`shared/styles/${name}`);
      }
    });

    it('App.ts imports ./styles.css so Vite bundles the CSS', () => {
      const app = read(`${dir}/src/App.ts`);
      expect(app).toMatch(/import\s+['"]\.\/styles\.css['"]/);
    });

    it('index.html has no runtime shared/styles link tags', () => {
      const html = read(`${dir}/index.html`);
      expect(html).not.toMatch(/<link[^>]+shared\/styles/);
    });
  });
}
