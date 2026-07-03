import type { PaletteEntry, SparsePixel } from "@pixode/asset-core";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function renderSnippetPreviewDataUrl(
  width: number,
  height: number,
  pixels: SparsePixel[],
  palette: PaletteEntry[],
  maxSize = 64
): string {
  const paletteMap = new Map(palette.map((p) => [p.id, p.hex]));
  const scale = Math.min(maxSize / width, maxSize / height, 8);
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#f7f8f9";
  ctx.fillRect(0, 0, cw, ch);

  for (const p of pixels) {
    const hex = paletteMap.get(p.c);
    if (!hex) continue;
    const { r, g, b } = hexToRgb(hex);
    const a = p.a ?? 1;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(
      Math.floor(p.x * scale),
      Math.floor(p.y * scale),
      Math.ceil(scale),
      Math.ceil(scale)
    );
  }
  return canvas.toDataURL("image/png");
}

export function renderSnippetPreviewCanvas(
  width: number,
  height: number,
  pixels: SparsePixel[],
  palette: PaletteEntry[],
  maxSize = 64
): HTMLCanvasElement | null {
  const paletteMap = new Map(palette.map((p) => [p.id, p.hex]));
  const scale = Math.min(maxSize / width, maxSize / height, 8);
  const cw = Math.max(1, Math.round(width * scale));
  const ch = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f7f8f9";
  ctx.fillRect(0, 0, cw, ch);

  for (const p of pixels) {
    const hex = paletteMap.get(p.c);
    if (!hex) continue;
    const { r, g, b } = hexToRgb(hex);
    const a = p.a ?? 1;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(
      Math.floor(p.x * scale),
      Math.floor(p.y * scale),
      Math.ceil(scale),
      Math.ceil(scale)
    );
  }
  return canvas;
}
