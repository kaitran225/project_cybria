import type { PixelAssetDocument } from "../types.js";
import type { CompileResult, RasterGrid } from "../types.js";
import type { ExporterPlugin, ExportOutput, ExportTarget } from "./plugin.js";

function encodePNG(grid: RasterGrid): Uint8Array {
  const { width, height, pixels } = grid;

  const rawData = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter byte: None
    for (let x = 0; x < width; x++) {
      const px = pixels[y * width + x];
      const offset = y * (1 + width * 4) + 1 + x * 4;
      rawData[offset] = px.r;
      rawData[offset + 1] = px.g;
      rawData[offset + 2] = px.b;
      rawData[offset + 3] = Math.round(px.a * 255);
    }
  }

  const deflated = deflateRaw(rawData);

  // Build PNG file
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", deflated);
  const iendChunk = makeChunk("IEND", new Uint8Array(0));

  const png = new Uint8Array(
    signature.length +
    ihdrChunk.length +
    idatChunk.length +
    iendChunk.length
  );
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdrChunk, offset); offset += ihdrChunk.length;
  png.set(idatChunk, offset); offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeU32(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeU32(chunk, 8 + data.length, crc);
  return chunk;
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

// Minimal DEFLATE: store blocks only (no compression), wrapped in zlib
function deflateRaw(data: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const numBlocks = Math.ceil(data.length / maxBlock) || 1;
  const out = new Uint8Array(2 + data.length + numBlocks * 5 + 4);
  let pos = 0;

  // zlib header
  out[pos++] = 0x78;
  out[pos++] = 0x01;

  for (let i = 0; i < data.length; i += maxBlock) {
    const remaining = data.length - i;
    const blockLen = Math.min(remaining, maxBlock);
    const isLast = i + blockLen >= data.length;
    out[pos++] = isLast ? 1 : 0;
    out[pos++] = blockLen & 0xff;
    out[pos++] = (blockLen >> 8) & 0xff;
    out[pos++] = ~blockLen & 0xff;
    out[pos++] = (~blockLen >> 8) & 0xff;
    out.set(data.subarray(i, i + blockLen), pos);
    pos += blockLen;
  }

  // Adler-32 checksum
  const adler = adler32(data);
  writeU32(out, pos, adler);
  pos += 4;

  return out.subarray(0, pos);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function compositeSheet(compiled: CompileResult): RasterGrid {
  const { width, height } = compiled.canvas;
  const frameCount = compiled.frames.length;
  const sheetWidth = width * frameCount;

  const pixels = new Array(sheetWidth * height);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = { r: 0, g: 0, b: 0, a: 0 };
  }

  for (const frame of compiled.frames) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = frame.grid.pixels[y * width + x];
        const dstX = frame.index * width + x;
        pixels[y * sheetWidth + dstX] = { ...src };
      }
    }
  }

  return { width: sheetWidth, height, pixels };
}

export class PngExporter implements ExporterPlugin {
  readonly target: ExportTarget = {
    format: "png",
    label: "PNG Sprite Sheet",
  };

  canExport(): boolean {
    return true;
  }

  export(doc: PixelAssetDocument, compiled: CompileResult): ExportOutput[] {
    const sheet = compositeSheet(compiled);
    const pngData = encodePNG(sheet);
    return [
      {
        filename: `${doc.id}.png`,
        contentType: "image/png",
        data: pngData,
      },
    ];
  }
}

export { encodePNG, compositeSheet };
