#!/usr/bin/env node
/**
 * Generate Samsung Seller Office LISTING images for the Tizen release.
 * These are NOT inside the .wgt — they are metadata uploaded in Seller Office
 * (verified 2026-10-23 against developer.samsung.com/smarttv/design/
 * app-icons-and-screenshots + tv-seller-office entering-application-information):
 *
 *   OFFICIAL SPEC — App Icons and Screenshots, Table 1 (1920x1080 icon) and
 *   Table 2 (512x423 icon):
 *     1920x1080 icon = TWO separate uploads:
 *       File 1  Logo Image        1920x1080  < 300 KB (72 DPI)  32-bit PNG (RGBA)  <- TRANSPARENT
 *       File 2  Background Image  1920x1080  < 300 KB (72 DPI)  24-bit PNG (RGB)   <- OPAQUE
 *     512x423 icon = ONE upload:
 *       Logo Image      512x423  < 300 KB (72 DPI)  24-bit PNG (RGB)  <- OPAQUE
 *   (Table 3: 4 screenshots, 1920x1080, < 500 KB, JPG — captured from the app by
 *    scripts/capture-store-screens.mjs, NOT here.)
 *
 *   entering-application-information ("App Images"): "For the logo image, upload a
 *   transparent image sized 1920x1080 pixels, in the 32-bit PNG(RGBA) format, and
 *   with a file size of 300kb or less. For the background image, upload an image
 *   sized 1920x1080 pixels, in the 24-bit PNG(RGB) or JPG format, and with a file
 *   size of 300kb or less. For the 512x423 size icon, upload an image sized
 *   512x423 pixels, in the PNG format, and with a file size of 300kb or less."
 *
 * Source art: platforms/tizen/public/hd_overhang_logo.png (365x210 TRANSPARENT brand
 * mark, srgba). The brand mark is scaled to each target's max box and centred:
 *   - 512x423     : mark over a SOLID #101218 bg  -> opaque 24-bit RGB (png24:)
 *   - 1920x1080   : mark over a TRANSPARENT canvas -> 32-bit RGBA (png32:),
 *                    + a SEPARATE solid #101218 background image -> 24-bit RGB (png24:)
 *   This is exactly the "logo image + background image" composition Samsung requires
 *   for the 1920x1080 icon.
 *
 * NOTE on bit depth: ImageMagick 7 honours the `png24:` / `png32:` FORMAT PREFIXES to
 * force the PNG IHDR color-type byte (2 = 24-bit RGB, 6 = 32-bit RGBA). The `-define
 * png:color-type=N` form is NOT reliable in 7.1.x (it silently writes a palette), so
 * we use the prefixes and then verify the actual IHDR byte below.
 *
 * Usage: node scripts/gen-store-images.mjs [outDir]
 * Default outDir: platforms/tizen/build/store-assets
 * Requires ImageMagick (convert) — present on the self-hosted runner.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const LOGO = join(REPO, 'platforms/tizen/public/hd_overhang_logo.png');
const BG = '#101218'; // matches app screen background brand color
const KB = 1024;
const ICON_LIMIT = 300 * KB; // app-icons-and-screenshots, Tables 1+2

const outDir = resolve(process.argv[2] ?? join(REPO, 'platforms/tizen/build/store-assets'));

/** PNG IHDR: width(16) height(20) bitDepth(24) colorType(25) — big-endian. */
function readPngHeader(file) {
  const b = readFileSync(file);
  return {
    w: b.readUInt32BE(16),
    h: b.readUInt32BE(20),
    bitDepth: b.readUInt8(24),
    colorType: b.readUInt8(25), // 0 gray, 2 RGB(24-bit), 3 palette, 4 gray+alpha, 6 RGBA(32-bit)
  };
}

/** 'true' if every pixel is fully opaque (no transparent region); 'false' otherwise. */
function hasTransparency(file) {
  const out = execFileSync('identify', ['-format', '%[opaque]', file], { encoding: 'utf-8' });
  // ImageMagick emits "True"/"False" (capitalised); normalise to be safe.
  return out.trim().toLowerCase() === 'false';
}

/**
 * Build one icon file:
 *   mode 'opaque' : solid #101218 canvas, brand mark centred, alpha removed -> png24: (24-bit RGB)
 *   mode 'logo'   : TRANSPARENT canvas, brand mark centred, alpha kept      -> png32: (32-bit RGBA)
 * The canvas is its own file so a stray `-resize` can never resize the canvas.
 */
function buildComposite(out, canvasW, canvasH, logoMaxW, logoMaxH, mode) {
  const canvasFile = `${out}.canvas.png`;
  const logoFile = `${out}.logo.png`;
  const outPrefix = mode === 'logo' ? 'png32:' : 'png24:'; // force 32-bit RGBA / 24-bit RGB
  try {
    execFileSync('convert', [
      '-size',
      `${canvasW}x${canvasH}`,
      mode === 'logo' ? 'xc:none' : `xc:${BG}`,
      canvasFile,
    ]);
    // scale the 365x210 mark up to fill the target box (lanczos, aspect preserved)
    execFileSync('convert', [
      LOGO,
      '-filter',
      'lanczos',
      '-resize',
      `${logoMaxW}x${logoMaxH}`,
      logoFile,
    ]);
    const args = [canvasFile, logoFile, '-gravity', 'center', '-composite'];
    if (mode === 'opaque') args.push('-background', BG, '-alpha', 'remove');
    args.push(`${outPrefix}${out}`);
    execFileSync('convert', args);
  } finally {
    try {
      execFileSync('rm', ['-f', canvasFile, logoFile]);
    } catch {}
  }
}

/** Solid brand-colour background image, opaque 24-bit RGB (Table 1 File 2). */
function buildBackground(out, canvasW, canvasH) {
  execFileSync('convert', [
    '-size',
    `${canvasW}x${canvasH}`,
    `xc:${BG}`,
    '-alpha',
    'off',
    `png24:${out}`,
  ]);
}

// Max logo box per target. 1920x1080 uses 3x the 365x210 source; 512x423 uses ~1x.
// Both keep the mark centred with a safe margin inside the squircle area
// (app-icons-and-screenshots Figures 2/5: "leave space around it").
const TARGETS = [
  {
    name: 'listing-icon-512x423.png',
    w: 512,
    h: 423,
    logoW: 384,
    logoH: 220,
    build: 'opaque',
    want: { colorType: 2, transparent: false },
  },
  {
    name: 'listing-logo-1920x1080.png',
    w: 1920,
    h: 1080,
    logoW: 1095,
    logoH: 630,
    build: 'logo',
    want: { colorType: 6, transparent: true },
  },
  {
    name: 'listing-background-1920x1080.png',
    w: 1920,
    h: 1080,
    build: 'background',
    want: { colorType: 2, transparent: false },
  },
];

if (!existsSync(LOGO)) {
  console.error(`missing master art: ${LOGO}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const t of TARGETS) {
  const out = join(outDir, t.name);
  if (t.build === 'background') buildBackground(out, t.w, t.h);
  else buildComposite(out, t.w, t.h, t.logoW, t.logoH, t.build);

  const p = readPngHeader(out);
  const bytes = statSync(out).size;
  const transparent = hasTransparency(out);
  const okDims = p.w === t.w && p.h === t.h;
  const okSize = bytes < ICON_LIMIT;
  const okType = p.colorType === t.want.colorType && p.bitDepth === 8;
  const okAlpha = transparent === t.want.transparent;
  const ok = okDims && okSize && okType && okAlpha;
  if (!ok) failed = true;
  const label = t.want.colorType === 6 ? '32-bit RGBA' : '24-bit RGB';
  console.log(
    `${ok ? 'OK ' : 'BAD'} ${t.name} ${p.w}x${p.h} ${(bytes / KB).toFixed(1)} KB (${ICON_LIMIT / KB} KB cap) ` +
      `ct=${p.colorType} depth=${p.bitDepth} ${label} ${t.want.transparent ? 'transparent' : 'opaque'}=${okAlpha}`
  );
  if (!okType)
    console.error(`    !! expected color-type ${t.want.colorType} (${label}), got ${p.colorType}`);
  if (!okAlpha)
    console.error(
      `    !! expected ${t.want.transparent ? 'transparency' : 'opaque'}, got transparent=${transparent}`
    );
}
if (failed) {
  console.error('store listing image generation failed Samsung icon spec (Tables 1/2)');
  process.exit(1);
}
console.log('Store listing images ready for Seller Office upload:');
console.log('  1920x1080 -> listing-logo-1920x1080.png (Logo, 32-bit RGBA transparent)');
console.log('             + listing-background-1920x1080.png (Background, 24-bit RGB)');
console.log('  512x423   -> listing-icon-512x423.png (24-bit RGB opaque)');
console.log('Screenshots: run scripts/capture-store-screens.mjs against the FINAL build.');
