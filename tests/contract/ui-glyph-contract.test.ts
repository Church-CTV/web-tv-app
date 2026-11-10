/**
 * UI glyph contract: user-visible markup may not depend on emoji codepoints.
 *
 * The failure mode is invisible from the dev machine. Chromium with Noto Color Emoji
 * paints `⚠️` as a yellow 64 px block; the same string on a bare Tizen/webOS font stack is
 * a thin outline, a monochrome triangle, or a box - and the e2e baseline only ever pins
 * one of them. Every icon in the shipped UI is therefore inline SVG (or a PNG the build
 * pins), and this test keeps new code from sliding back into text art.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = [
  'shared',
  'core/src',
  'platforms/webos/src',
  'platforms/tizen/src',
  'platforms/vizio/src',
];
// U+2600-U+27BF miscellaneous symbols/dingbats, U+2B00+ arrows/stars, and emoji presentation selectors.
// Variation selector and ZWJ are matched separately: ESLint (rightly) refuses
// combining marks inside a character class.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\uFE0F|\u200D/u;
// Characters that live in CSS `content:` fallbacks are covered by the stylesheet rule below:
// they are decorative, sit inside a coloured tile, and are not the only signal of state.
const CSS_CONTENT_ALLOWED = /content:\s*["']?[^\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function files(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) files(rel, out);
    else if (/\.(ts|css)$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(rel);
  }
  return out;
}

describe('no user-visible markup depends on an emoji codepoint', () => {
  const sources = DIRS.flatMap((d) => files(d)).filter((f) => f.endsWith('.ts'));

  it('the scan is not vacuous (source files were actually read)', () => {
    expect(sources.length).toBeGreaterThan(40);
  });

  for (const file of sources) {
    it(`${file} renders no font-resolved emoji`, () => {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      // Comments may *name* a glyph (that is how you document why it is gone); only code
      // and strings are what the user sees.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const line = code.split('\n').findIndex((l) => EMOJI.test(l));
      expect(line, `${file}:${line + 1} puts an emoji glyph in shipped UI code`).toBe(-1);
    });
  }

  it('stylesheets keep their decorative CSS content free of emoji pictographs', () => {
    const offenders = DIRS.flatMap((d) => files(d))
      .filter((f) => f.endsWith('.css'))
      .filter((f) => {
        const text = readFileSync(path.join(ROOT, f), 'utf8');
        return text
          .split('\n')
          .some(
            (l) =>
              /content:\s*["']/.test(l) &&
              /[\u{1F300}-\u{1FAFF}]|\uFE0F/u.test(l) &&
              !CSS_CONTENT_ALLOWED.test(l)
          );
      });
    expect(offenders).toEqual([]);
  });
});
