#!/usr/bin/env node
// Generates simple gradient+letter PNG icons without any external dependencies.
// Run with: node scripts/generate-icons.js
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'src', 'icons');
mkdirSync(outDir, { recursive: true });

const SIZES = [16, 32, 48, 96, 128];

// 5x7 pixel bitmap of the letter "G" (1 = draw, 0 = skip).
const GLYPH_G = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function gradientColor(x, y, size) {
  // Diagonal gradient from teal (#2cc5b8) to blue-violet (#5b4dff).
  const t = (x + y) / (2 * (size - 1));
  return [lerp(0x2c, 0x5b, t), lerp(0xc5, 0x4d, t), lerp(0xb8, 0xff, t)];
}

function glyphHit(x, y, size) {
  const scale = size / 16;
  const padX = Math.round(4 * scale);
  const padY = Math.round(4 * scale);
  const glyphW = size - 2 * padX;
  const glyphH = size - 2 * padY;
  const localX = x - padX;
  const localY = y - padY;
  if (localX < 0 || localY < 0 || localX >= glyphW || localY >= glyphH) {
    return false;
  }
  const col = Math.floor((localX / glyphW) * 5);
  const row = Math.floor((localY / glyphH) * 7);
  return GLYPH_G[row]?.[col] === 1;
}

function buildPixelData(size) {
  // Each row prefixed with filter byte 0 (None).
  const rowLen = size * 4 + 1;
  const data = Buffer.alloc(rowLen * size);
  const radius = size * 0.48;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowLen;
    data[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const i = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const insideCircle = dist <= radius;
      if (!insideCircle) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        continue;
      }
      if (glyphHit(x, y, size)) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        const [r, g, b] = gradientColor(x, y, size);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  }
  return data;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(buildPixelData(size));
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of SIZES) {
  const png = makePng(size);
  const out = resolve(outDir, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
