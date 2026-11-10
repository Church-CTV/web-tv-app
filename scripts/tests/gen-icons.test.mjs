/**
 * gen-icons unit tests: the generated PNGs must be structurally VALID,
 * not just present. Regression: the original crc32 implementation produced
 * wrong chunk checksums for every emitted file (strict decoders reject them;
 * TV runtimes tolerated it). These tests recompute every chunk CRC with
 * node:zlib.crc32 (authoritative) and assert full structural integrity.
 */
import { genIcons, crc32 } from '../gen-icons.mjs';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inflateSync } from 'zlib';
import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Parse a PNG into chunks and verify every chunk CRC (zlib.crc32 is ground truth). */
function verifyPng(buf) {
  const problems = [];
  if (buf.subarray(0, 8).compare(PNG_SIG) !== 0) problems.push('bad PNG signature');
  let off = 8;
  const chunks = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (off + 8 + len + 4 > buf.length) {
      problems.push(`${type}: truncated (file ends mid-chunk)`);
      break;
    }
    const storedCrc = buf.readUInt32BE(off + 8 + len);
    const actualCrc = zlib.crc32(buf.subarray(off + 4, off + 8 + len)) >>> 0;
    if (storedCrc !== actualCrc) {
      problems.push(`${type}: chunk CRC mismatch (stored ${storedCrc.toString(16)}, actual ${actualCrc.toString(16)})`);
    }
    chunks.push({ type, len });
    off += 8 + len + 4;
  }
  if (off !== buf.length) problems.push(`${buf.length - off} trailing bytes after final chunk`);
  const types = chunks.map((c) => c.type);
  if (types[0] !== 'IHDR') problems.push('first chunk is not IHDR');
  if (types[types.length - 1] !== 'IEND') problems.push('last chunk is not IEND');
  if (!types.includes('IDAT')) problems.push('no IDAT chunk');
  return { problems, chunks };
}

let outDir;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'gen-icons-'));
  genIcons(outDir);
});

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('gen-icons crc32', () => {
  test('matches known CRC-32 vectors', () => {
    // Vectors verified against python3 zlib.crc32 (reference implementation).
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from('IEND'))).toBe(0xae426082);
    expect(
      crc32(Buffer.from('The quick brown fox jumps over the lazy dog'))
    ).toBe(0x414fa339);
  });

  test('agrees with node:zlib.crc32 on random buffers', () => {
    for (let i = 0; i < 20; i++) {
      const buf = Buffer.alloc(1 + Math.floor(Math.random() * 200));
      for (let j = 0; j < buf.length; j++) buf[j] = Math.floor(Math.random() * 256);
      expect(crc32(buf)).toBe(zlib.crc32(buf) >>> 0);
    }
  });
});

describe('generated PNG files', () => {
  const expected = [
    ['icon-80.png', 80, 80],
    ['icon-130.png', 130, 130],
    ['icon-120.png', 120, 120],
    ['icon.png', 240, 240],
    ['splash.png', 1280, 720],
  ];

  test.each(expected)('%s: all chunk CRCs valid and structure intact', (name) => {
    const buf = readFileSync(join(outDir, name));
    const { problems } = verifyPng(buf);
    expect(problems, `${name}: ${problems.join('; ')}`).toEqual([]);
  });

  test.each(expected)('%s: IHDR declares %dx%d', (name, w, h) => {
    const buf = readFileSync(join(outDir, name));
    expect(buf.readUInt32BE(16)).toBe(w);
    expect(buf.readUInt32BE(20)).toBe(h);
  });

  test.each(expected)('%s: IDAT is a valid deflate stream decoding to exact RGB raw size', (name, w, h) => {
    // Regression: icons were once emitted with RAW (stored) IDAT bytes, which
    // is not valid PNG; strict decoders reject them outright.
    const buf = readFileSync(join(outDir, name));
    const idatStart = buf.indexOf('IDAT') + 4;
    const idatLen = buf.readUInt32BE(idatStart - 4);
    const idat = buf.subarray(idatStart, idatStart + idatLen);
    const raw = inflateSync(idat);
    expect(raw.length).toBe(h * (w * 3 + 1));
  });

  test('splash IDAT is a valid deflate stream (compressed mode)', () => {
    const buf = readFileSync(join(outDir, 'splash.png'));
    const idatStart = buf.indexOf('IDAT') + 4;
    const idatLen = buf.readUInt32BE(idatStart - 4);
    const idat = buf.subarray(idatStart, idatStart + idatLen);
    const raw = inflateSync(idat);
    expect(raw.length).toBe(720 * (1280 * 3 + 1));
  });

  test('all icons exceed the 1 KB store-validity floor', () => {
    for (const [name] of expected) {
      const size = readFileSync(join(outDir, name)).length;
      expect(size, `${name} too small`).toBeGreaterThan(1024);
    }
  });
});
