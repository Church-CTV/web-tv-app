/**
 * Pinned-asset contract (WEB-015a): the one art file whose compressed bytes move with the
 * toolchain is checked in, so a release's bytes stop depending on which Node built it.
 *
 * Why this file exists: `splash.png` is written with `node:zlib.deflateSync(level 9)`, and
 * that encoder's output changes between Node builds. Measured against the DOWNLOADED
 * published `v0.1.0` bytes: the shipped splash is 4198 B and a rebuild here produced 4188 B
 * for PIXEL-IDENTICAL art (both decode to pixel hash `51fb71e8`). Everything else in the
 * package matched across toolchains, because the icons are stored, not deflated. So one
 * 4198-byte file stood between "reproducible on the toolchain that built it" and
 * "reproducible anywhere".
 *
 * The rule it locks, in both directions:
 *   - `assets/generated/splash.png` exists, is tracked, and renders the current design at
 *     the pixel level (a stale or hand-edited picture fails here, not in a store review);
 *   - the webOS packager ships THAT file and never the one it regenerates, so packaging
 *     cannot reintroduce encoder drift;
 *   - launcher icons use the pinned Roku artwork requested for this channel;
 *     legacy generated icons are no longer the launcher assets.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chromaSplash } from '../gen-icons.mjs';
import { decodePNG } from '../lib/png-decode.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PINNED = 'assets/generated/splash.png';

function referenceRGB(width, height, px) {
  const buf = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = px(x, y);
      const o = (y * width + x) * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  return buf;
}

describe('pinned generated assets (WEB-015a)', () => {
  it('keeps the pinned splash in version control, not in a generated directory', () => {
    const abs = resolve(ROOT, PINNED);
    expect(existsSync(abs), `${PINNED} is missing; packaging would fall back to the encoder`).toBe(
      true
    );
    const tracked = execFileSync('git', ['ls-files', '--error-unmatch', PINNED], {
      cwd: ROOT,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    expect(
      tracked,
      `${PINNED} is present on disk but untracked, so a fresh clone cannot build it`
    ).toBe(PINNED);
  });

  it('pins art that renders the design the generator defines', () => {
    const decoded = decodePNG(resolve(ROOT, PINNED));
    expect([decoded.width, decoded.height, decoded.colorType]).toEqual([1280, 720, 2]);
    const expected = referenceRGB(1280, 720, chromaSplash(1280, 720));
    expect(
      decoded.pixels.equals(expected),
      `${PINNED} no longer renders scripts/gen-icons.mjs's splash design. Run ` +
        '`npm run icons:pin` to re-render it from source, or fix the design in both places.'
    ).toBe(true);
  });

  it('ships the pinned splash and never the freshly deflated one', () => {
    const packager = readFileSync(resolve(ROOT, 'platforms/webos/scripts/package.sh'), 'utf8');
    expect(
      packager,
      `the webOS packager must stage ${PINNED}; staging the regenerated file reintroduces ` +
        'deflate drift, which is what made published bytes unreproducible'
    ).toContain(PINNED);
    const stageLine = packager
      .split('\n')
      .find((l) => l.includes('STAGE_DIR/assets/splash.png') && l.trim().startsWith('cp '));
    expect(stageLine, 'the webOS packager no longer stages assets/splash.png at all').toBeTruthy();
    expect(
      stageLine,
      `assets/splash.png is staged from "${stageLine.trim()}" - it must come from ${PINNED}`
    ).toContain(PINNED);
  });

  it('stages the pinned Roku launcher independently of legacy generated art', () => {
    const packager = readFileSync(resolve(ROOT, 'platforms/webos/scripts/package.sh'), 'utf8');
    for (const size of [80, 130]) {
      const stageLine = packager
        .split('\n')
        .find(
          (line) =>
            line.trim().startsWith('cp ') &&
            line.includes(`STAGE_DIR/assets/launcher-roku-${size}.png`)
        );
      expect(stageLine, `launcher ${size} must be staged from the pinned brand input`).toContain(
        `REPO_ROOT/assets/launcher/roku-${size}.png`
      );
    }
  });
});
