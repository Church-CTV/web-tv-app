#!/usr/bin/env node
// Generate simple, valid PNG icons for channel packaging.
// Each platform references icons in its manifest/appinfo; the files must exist
// for the packaged channel to install cleanly on-device.
//
// Produces (relative to this script): ../assets/<name>.png
// - icon-80.png   (80x80)   — webOS icon
// - icon-130.png  (130x130) — webOS largeIcon
// - icon-120.png  (120x120) — Vizio manifest icon
// - icon.png      (240x240) — Tizen config.xml icon
// - splash.png    (1280x720) — webOS splash / bgImage / splashBackground

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- minimal PNG encoder (RGB, no filter, no interlace) --------------------
// CRC-32 (IEEE 802.3, reflected) for PNG chunk checksums. The previous
// low-byte splice variant produced WRONG checksums: every PNG this script
// emitted failed strict decoders (ImageMagick "IHDR: CRC error") and only
// worked because TV runtimes tolerate bad chunk CRCs. Keep this exact
// bit-wise form (full-word feedback), or scripts/tests/gen-icons.test.mjs
// will fail on the zlib.crc32 cross-check.
export function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc ^ buf[i]) >>> 0;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (0xedb88320 ^ (crc >>> 1)) >>> 0 : (crc >>> 1) >>> 0;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, pixelFn, { compress = false } = {}) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const off = y * (width * 3 + 1) + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  // IDAT payload is ALWAYS a zlib stream: raw/stored bytes are not valid PNG
  // (strict decoders fail with "incorrect header check"; only lenient TV
  // runtimes tolerated it). Icons use level 0 (stored deflate blocks: keeps
  // their byte size above the >1 KB store-validity floor while remaining
  // spec-valid); the splash uses level 9 to keep the package small.
  const idat = deflateSync(raw, { level: compress ? 9 : 0 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- icon designs ----------------------------------------------------------
// Chroma brand mark: a dark TV screen with a soft red→magenta gradient band.
export function chromaTV(size) {
  const bg = [16, 18, 24]; // near-black screen
  const bandTop = Math.floor(size * 0.42);
  const bandBot = Math.floor(size * 0.58);
  return (_x, y) => {
    const inBand = y >= bandTop && y < bandBot;
    if (!inBand) return bg;
    const t = (y - bandTop) / (bandBot - bandTop); // 0..1
    const r = Math.round(224 + (140 - 224) * t);
    const g = Math.round(48 + (20 - 48) * t);
    const b = Math.round(72 + (160 - 72) * t);
    return [r, g, b];
  };
}

// Splash: wider band for 1280x720 TV resolution
export function chromaSplash(_w, h) {
  const bg = [16, 18, 24];
  const bandTop = Math.floor(h * 0.42);
  const bandBot = Math.floor(h * 0.58);
  return (_x, y) => {
    const inBand = y >= bandTop && y < bandBot;
    if (!inBand) return bg;
    const t = (y - bandTop) / (bandBot - bandTop);
    const r = Math.round(224 + (140 - 224) * t);
    const g = Math.round(48 + (20 - 48) * t);
    const b = Math.round(72 + (160 - 72) * t);
    return [r, g, b];
  };
}

const TARGETS = [
  { name: 'icon-80.png', width: 80, height: 80, px: chromaTV(80), compress: false },
  { name: 'icon-130.png', width: 130, height: 130, px: chromaTV(130), compress: false },
  { name: 'icon-120.png', width: 120, height: 120, px: chromaTV(120), compress: false },
  { name: 'icon.png', width: 240, height: 240, px: chromaTV(240), compress: false },
  { name: 'splash.png', width: 1280, height: 720, px: chromaSplash(1280, 720), compress: true },
];

/**
 * Generate all icon/splash PNGs into the given output directory.
 * Returns an array of { name, path, bytes } objects for what was written.
 */
export function genIcons(outDir) {
  const resolvedOutDir = resolve(outDir);
  mkdirSync(resolvedOutDir, { recursive: true });
  const results = [];
  for (const t of TARGETS) {
    const file = join(resolvedOutDir, t.name);
    const png = encodePNG(t.width, t.height, t.px, { compress: t.compress });
    writeFileSync(file, png);
    results.push({ name: t.name, path: file, bytes: png.length });
  }
  return results;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const OUT_DIR = resolve(process.argv[2] ?? join(__dirname, 'assets'));
  for (const r of genIcons(OUT_DIR)) {
    console.log(`wrote ${r.path} (${(r.bytes / 1024).toFixed(1)} KB)`);
  }
}
