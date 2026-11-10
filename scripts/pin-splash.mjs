#!/usr/bin/env node
/**
 * Re-render the pinned splash input from source (WEB-015a): `npm run icons:pin`.
 *
 * What is pinned and why: `assets/generated/splash.png` is the exact file the webOS package
 * ships. It is the one artifact whose compressed bytes depend on the deflate implementation -
 * published `v0.1.0` carries a 4198 B splash and the same design on Node 22.22.1 deflates to
 * 4188 B, pixel for pixel identical. Committing the file stops published bytes from moving
 * when the runner's Node moves.
 *
 * When to run it: after a CHANGE TO THE DESIGN in `scripts/gen-icons.mjs`. Nothing else.
 * `scripts/tests/pinned-assets.test.mjs` decodes the pinned file and compares its PIXELS to
 * what `chromaSplash()` renders today, so a stale, hand-edited or wrong-resolution file fails
 * CI loudly instead of reaching a TV. Container bytes are deliberately not asserted - they
 * are what drifts between toolchains, and re-pinning to a new toolchain's output without a
 * design change is reported here so the diff is never a surprise.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genIcons } from './gen-icons.mjs';
import { requireNamed } from './lib/artifact-lookup.mjs';
import { decodePNG } from './lib/png-decode.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'assets', 'generated', 'splash.png');

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const short = (hex) => hex.slice(0, 12);
const pixelHash = (file) => sha(decodePNG(file).pixels);

const tmp = mkdtempSync(join(tmpdir(), 'pin-splash-'));
try {
  // A missing entry would read as `undefined.path`: the named error says the generator stopped
  // producing the file this pin exists to freeze.
  const render = requireNamed(genIcons(tmp), 'splash.png', 'gen-icons');
  const fresh = readFileSync(render.path);

  const before = existsSync(TARGET) ? readFileSync(TARGET) : null;
  // Read the old pixels before overwriting: after writeFileSync the file no longer knows
  // what it used to be.
  const pixelsBefore = before !== null ? pixelHash(TARGET) : null;
  const pixelsUnchanged = pixelsBefore !== null && pixelsBefore === pixelHash(render.path);

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, fresh);

  console.log(
    `wrote ${TARGET.replace(`${ROOT}/`, '')}: ${fresh.length} B, sha ${short(sha(fresh))}, ` +
      `pixels ${short(pixelHash(render.path))}`
  );
  if (before) {
    console.log(
      `  was ${before.length} B, sha ${short(sha(before))}, pixels ${short(pixelsBefore)}`
    );
    if (pixelsUnchanged) {
      console.log(
        '  NOTE: the design is unchanged; only the container bytes were re-pinned. Commit this ' +
          'only if you want the release pinned to this toolchain - the pixel gate does not need it.'
      );
    } else {
      console.log('  NOTE: the design changed. Commit the new file with the generator change.');
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
