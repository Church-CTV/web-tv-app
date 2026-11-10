/**
 * PNG decoder unit tests: the pixel-level comparison gate must itself be trustworthy.
 *
 * `scripts/lib/png-decode.mjs` exists so that pinned art can be validated on its PICTURE
 * rather than its compressed bytes (deflate output moves with the Node build). If the
 * decoder silently mis-un-filters a row, every gate that leans on it becomes theatre, so
 * these tests feed it files with known pixels and known damage.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crc32, genIcons, chromaSplash, chromaTV } from '../gen-icons.mjs';
import { decodePNG, readChunks } from './png-decode.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** One well-formed PNG chunk: length, type, data and a matching CRC. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let outDir;
let splashPath;
let iconPath;

/** Rebuild the design straight from the generator's pixel functions, no encoder involved. */
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

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'png-decode-'));
  genIcons(outDir);
  splashPath = join(outDir, 'splash.png');
  iconPath = join(outDir, 'icon-80.png');
});

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('png-decode chunks', () => {
  it('accepts a generated PNG and reports its chunk order', () => {
    const types = readChunks(splashPath).map((c) => c.type);
    expect(types[0]).toBe('IHDR');
    expect(types).toContain('IDAT');
    expect(types[types.length - 1]).toBe('IEND');
  });

  it('rejects a flipped byte inside IDAT on CRC, not on a wrong picture', () => {
    const buf = Buffer.from(readFileSync(splashPath));
    const idatAt = buf.indexOf(Buffer.from('IDAT', 'latin1'));
    buf[idatAt + 6] ^= 0xff; // corrupt one data byte
    expect(() => readChunks(buf)).toThrow(/CRC/);
  });

  it('rejects a truncated file instead of decoding what is left', () => {
    const buf = readFileSync(splashPath).subarray(0, 40);
    expect(() => readChunks(buf)).toThrow();
  });

  it('names the chunk whose CRC is missing instead of reading past the buffer', () => {
    // The boundary the CRC read used to walk off the end of the buffer at: a chunk with a complete
    // header AND complete data whose four CRC bytes are absent. A zero-length IEND cut the same way
    // is caught earlier by the header guard, so this feeds a real IDAT payload with no CRC after it.
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(3, 0);
    ihdr.writeUInt32BE(2, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const idat = deflateSync(Buffer.from([1, 2, 3, 4]));
    const idatLen = Buffer.alloc(4);
    idatLen.writeUInt32BE(idat.length);
    const crcless = Buffer.concat([
      PNG_SIGNATURE,
      chunk('IHDR', ihdr),
      idatLen,
      Buffer.from('IDAT', 'latin1'),
      idat, // complete data, and then the file simply stops
    ]);
    expect(() => readChunks(crcless)).toThrow(
      /IDAT chunk is missing its CRC \(need \d+ bytes, the file has \d+\)/
    );
  });

  it('rejects a non-PNG input', () => {
    const f = join(outDir, 'not-a-png.bin');
    writeFileSync(f, Buffer.from('this is not a PNG file at all, not even close'));
    expect(() => decodePNG(f)).toThrow(/not a PNG/);
  });
});

describe('png-decode pixels', () => {
  it('decodes the splash to the exact pixels the design function renders', () => {
    const decoded = decodePNG(splashPath);
    expect(decoded.width).toBe(1280);
    expect(decoded.height).toBe(720);
    expect(decoded.colorType).toBe(2); // truecolor, no alpha: what a splash background needs
    const expected = referenceRGB(1280, 720, chromaSplash(1280, 720));
    expect(decoded.pixels.equals(expected)).toBe(true);
  });

  it('decodes an icon to the pixels that design renders', () => {
    const decoded = decodePNG(iconPath);
    expect([decoded.width, decoded.height]).toEqual([80, 80]);
    // icon-80 carries an alpha channel, so compare the RGB triples only.
    if (decoded.channels === 4) {
      for (let i = 0; i < 80 * 80; i++) {
        const [r, g, b] = chromaTV(80)(i % 80, Math.floor(i / 80));
        expect([
          decoded.pixels[i * 4],
          decoded.pixels[i * 4 + 1],
          decoded.pixels[i * 4 + 2],
        ]).toEqual([r, g, b]);
      }
    } else {
      expect(decoded.pixels.equals(referenceRGB(80, 80, chromaTV(80)))).toBe(true);
    }
  });

  it('is stable across regenerations, which is the property the pinned-input gate needs', () => {
    const second = mkdtempSync(join(tmpdir(), 'png-decode-2-'));
    try {
      genIcons(second);
      const a = createHash('sha256').update(decodePNG(splashPath).pixels).digest('hex');
      const b = createHash('sha256')
        .update(decodePNG(join(second, 'splash.png')).pixels)
        .digest('hex');
      expect(b).toBe(a);
    } finally {
      rmSync(second, { recursive: true, force: true });
    }
  });
});

describe('png-decode filters', () => {
  // `scripts/gen-icons.mjs` only ever writes filter type 0, so the other four branches of the
  // decoder are code no gate in this repo otherwise reaches - yet a third-party encoder may pick
  // any of them, and a decoder that mis-un-filters a row turns every pixel gate into theatre.
  // The expectations below are hardcoded rather than round-tripped, so a decoder and a test
  // helper that agree on a WRONG rule still fail.
  const ROW0 = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  function pngWithRows(rows, name) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(3, 0); // width: 3 pixels
    ihdr.writeUInt32BE(2, 4); // height: 2 rows
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type 2: truecolor, no alpha
    const file = join(outDir, name);
    writeFileSync(
      file,
      Buffer.concat([
        PNG_SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0)),
      ])
    );
    return file;
  }

  // Spec predictors, written out per filter rather than shared with the Paeth case below.
  function encodeRow(filterType, target, prev) {
    const bpp = 3;
    const out = Buffer.alloc(target.length + 1);
    out[0] = filterType;
    for (let i = 0; i < target.length; i++) {
      const a = i >= bpp ? target[i - bpp] : 0;
      const b = prev[i];
      let pred = 0;
      if (filterType === 1) {
        pred = a;
      } else if (filterType === 2) {
        pred = b;
      } else if (filterType === 3) {
        pred = (a + b) >> 1;
      }
      out[i + 1] = (target[i] - pred) & 0xff;
    }
    return out;
  }

  const FILTER0_ROW0 = Buffer.concat([Buffer.from([0]), Buffer.from(ROW0)]);

  it('un-filters a Sub row against the pixel to its left', () => {
    const target = [1, 2, 3, 10, 20, 30, 100, 90, 80];
    const encoded = [1, 2, 3, 9, 18, 27, 90, 70, 50]; // target - left neighbour
    const file = pngWithRows(
      [FILTER0_ROW0, Buffer.concat([Buffer.from([1]), Buffer.from(encoded)])],
      'filter-sub.png'
    );
    const decoded = decodePNG(file);
    expect([decoded.width, decoded.height]).toEqual([3, 2]);
    expect(decoded.pixels.equals(Buffer.from([...ROW0, ...target]))).toBe(true);
  });

  it('un-filters an Up row against the pixel above', () => {
    const target = [15, 25, 35, 45, 55, 65, 75, 85, 95];
    const file = pngWithRows([FILTER0_ROW0, encodeRow(2, target, ROW0)], 'filter-up.png');
    expect(decodePNG(file).pixels.equals(Buffer.from([...ROW0, ...target]))).toBe(true);
  });

  it('un-filters an Average row, rounding the average down', () => {
    const target = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const encoded = [5, 10, 15, 15, 15, 15, 15, 15, 15]; // (left + above) >> 1, no rounding up
    const file = pngWithRows(
      [FILTER0_ROW0, Buffer.concat([Buffer.from([3]), Buffer.from(encoded)])],
      'filter-average.png'
    );
    expect(decodePNG(file).pixels.equals(Buffer.from([...ROW0, ...target]))).toBe(true);
  });

  it('resolves every Paeth predictor branch', () => {
    // Filter-4 deltas are written by hand, and so is the expected row: no predictor code is
    // shared with the decoder under test. Per R channel the spec sets p = a + b - c and picks
    // the neighbour closest to p, with a = left (decoded), b = above, c = upper-left:
    //   pixel 0: a=0,   b=200, c=0   -> p=200, pa=200 pb=0  pc=200 -> b -> 40 + 200 = 240
    //   pixel 1: a=240, b=205, c=200 -> p=245, pa=5   pb=40 pc=45  -> a -> 9  + 240 = 249
    //   pixel 2: a=249, b=160, c=205 -> p=204, pa=45  pb=44 pc=1   -> c -> 42 + 205 = 247
    // The G and B channels have zero neighbours throughout, so their predictor is 0.
    const above = [200, 0, 0, 205, 0, 0, 160, 0, 0];
    const deltas = [40, 0, 0, 9, 0, 0, 42, 0, 0];
    const expected = [240, 0, 0, 249, 0, 0, 247, 0, 0];
    const file = pngWithRows(
      [
        Buffer.concat([Buffer.from([0]), Buffer.from(above)]),
        Buffer.concat([Buffer.from([4]), Buffer.from(deltas)]),
      ],
      'filter-paeth.png'
    );
    expect(decodePNG(file).pixels.equals(Buffer.from([...above, ...expected]))).toBe(true);
  });

  it('rejects a filter type the spec does not define', () => {
    const file = pngWithRows(
      [FILTER0_ROW0, Buffer.concat([Buffer.from([9]), Buffer.from(ROW0)])],
      'filter-bogus.png'
    );
    expect(() => decodePNG(file)).toThrow(/unknown PNG filter type 9/);
  });
});
