/**
 * Minimal PNG reader, used to compare generated art at the PIXEL level.
 *
 * Why this file exists: `scripts/gen-icons.mjs` compresses `splash.png` through
 * `node:zlib.deflateSync(level 9)`, and that encoder's output moves with the Node build -
 * the published `v0.1.0` splash is 4198 B while the same design on Node 22.22.1 is 4188 B.
 * Byte equality therefore cannot be the test for art that is checked in as a pinned input
 * (`assets/generated/splash.png`): a different toolchain would "fail" a file whose picture
 * is correct. Pixel equality is the assertion that survives any encoder, so this decoder
 * exists to make it checkable. 8-bit non-interlaced greyscale/RGB/greyscale-alpha/RGBA is
 * the whole surface gen-icons emits; anything else fails closed rather than guessing.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { crc32 } from '../gen-icons.mjs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Split a PNG into validated chunks; every chunk CRC must match its type+data. */
export function readChunks(file) {
  const buf = typeof file === 'string' ? readFileSync(file) : file;
  if (buf.subarray(0, 8).compare(SIGNATURE) !== 0) {
    throw new Error(`${file}: not a PNG (bad signature)`);
  }
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    if (buf.length < off + 12) throw new Error(`${file}: truncated chunk header at ${off}`);
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (data.length !== len) throw new Error(`${file}: truncated ${type} chunk`);
    // The data can be complete while the trailing CRC is not. Reading the CRC then would run
    // past the end of the buffer and raise a bare RangeError naming neither the chunk nor the
    // bytes that are missing, which reads like a decoder bug rather than a damaged file.
    if (buf.length < off + 12 + len) {
      throw new Error(
        `${file}: ${type} chunk is missing its CRC (need ${off + 12 + len} bytes, the file has ${buf.length})`
      );
    }
    const storedCrc = buf.readUInt32BE(off + 8 + len);
    const actualCrc = crc32(buf.subarray(off + 4, off + 8 + len));
    if (storedCrc !== actualCrc) {
      throw new Error(`${file}: ${type} chunk CRC is ${storedCrc}, expected ${actualCrc}`);
    }
    chunks.push({ type, data });
    off += 12 + len;
  }
  const last = chunks[chunks.length - 1];
  if (!last || last.type !== 'IEND') throw new Error(`${file}: PNG has no trailing IEND chunk`);
  return chunks;
}

/**
 * Decode to raw pixels: Buffer of width*height*channels bytes, filter-reversed.
 * Returns { width, height, colorType, channels, pixels }.
 */
export function decodePNG(file) {
  const chunks = readChunks(file);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error(`${file}: PNG has no IHDR`);
  const { width, height, bitDepth, colorType, compression, filter, interlace } = {
    width: ihdr.data.readUInt32BE(0),
    height: ihdr.data.readUInt32BE(4),
    bitDepth: ihdr.data[8],
    colorType: ihdr.data[9],
    compression: ihdr.data[10],
    filter: ihdr.data[11],
    interlace: ihdr.data[12],
  };
  if (bitDepth !== 8) throw new Error(`${file}: bit depth ${bitDepth} unsupported (8 only)`);
  if (interlace !== 0)
    throw new Error(`${file}: interlaced PNG unsupported (Adam7 would need its own pass walk)`);
  if (compression !== 0 || filter !== 0) {
    throw new Error(`${file}: unexpected compression ${compression} / filter ${filter}`);
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`${file}: unsupported color type ${colorType}`);

  const idat = chunks.filter((c) => c.type === 'IDAT');
  if (!idat.length) throw new Error(`${file}: PNG has no IDAT`);
  const raw = inflateSync(Buffer.concat(idat.map((c) => c.data)));
  const stride = width * channels;
  if (raw.length !== height * (stride + 1)) {
    throw new Error(
      `${file}: inflated IDAT is ${raw.length} B, expected ${height * (stride + 1)} B`
    );
  }

  const pixels = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let value = row[x];
      switch (filterType) {
        case 0:
          break;
        case 1:
          value += a;
          break;
        case 2:
          value += b;
          break;
        case 3:
          value += (a + b) >> 1;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          // Explicit branches rather than a nested ternary. The Paeth predictor picks the
          // neighbour closest to p: a when it is at least as close as both others, otherwise b
          // when b is at least as close as c, otherwise c.
          if (pa <= pb && pa <= pc) {
            value += a;
          } else if (pb <= pc) {
            value += b;
          } else {
            value += c;
          }
          break;
        }
        default:
          throw new Error(`${file}: row ${y} uses unknown PNG filter type ${filterType}`);
      }
      cur[x] = value & 0xff;
    }
  }
  return { width, height, colorType, channels, pixels };
}
