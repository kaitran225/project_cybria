import type { PaletteEntry, SparsePixel } from "@pixode/asset-core";
import type { SelectionRect } from "./types.js";

export function drawCanvasOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  options: {
    showBounds?: boolean;
    showGrid?: boolean;
    showPixelGrid?: boolean;
    showCenterGuides?: boolean;
    selection?: SelectionRect | null;
  }
): void {
  const w = width * zoom;
  const h = height * zoom;

  if (options.showPixelGrid && zoom >= 32) {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * zoom + 0.5, 0);
      ctx.lineTo(x * zoom + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * zoom + 0.5);
      ctx.lineTo(w, y * zoom + 0.5);
      ctx.stroke();
    }
  }

  if (options.showGrid) {
    ctx.strokeStyle = "rgba(191,255,0,0.2)";
    ctx.lineWidth = 1;
    const step = 8;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x * zoom + 0.5, 0);
      ctx.lineTo(x * zoom + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y * zoom + 0.5);
      ctx.lineTo(w, y * zoom + 0.5);
      ctx.stroke();
    }
  }

  if (options.showCenterGuides) {
    const cx = (width / 2) * zoom;
    const cy = (height / 2) * zoom;
    ctx.strokeStyle = "rgba(245,166,35,0.5)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, 0);
    ctx.lineTo(cx + 0.5, h);
    ctx.moveTo(0, cy + 0.5);
    ctx.lineTo(w, cy + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (options.showBounds !== false) {
    ctx.strokeStyle = "#bfff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  if (options.selection) {
    const sel = options.selection;
    const minX = Math.min(sel.x0, sel.x1) * zoom;
    const minY = Math.min(sel.y0, sel.y1) * zoom;
    const maxX = (Math.max(sel.x0, sel.x1) + 1) * zoom;
    const maxY = (Math.max(sel.y0, sel.y1) + 1) * zoom;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.setLineDash([]);
  }
}

export function drawSnippetDropPreview(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  palette: PaletteEntry[],
  snippet: { width: number; height: number; pixels: SparsePixel[] },
  originX: number,
  originY: number,
  options?: { center?: boolean }
): void {
  let ox = originX;
  let oy = originY;
  if (options?.center) {
    ox = originX - Math.floor(snippet.width / 2);
    oy = originY - Math.floor(snippet.height / 2);
  }

  const paletteMap = new Map(palette.map((p) => [p.id, p.hex]));
  ctx.globalAlpha = 0.55;
  for (const p of snippet.pixels) {
    const hex = paletteMap.get(p.c);
    if (!hex) continue;
    ctx.fillStyle = hex;
    ctx.fillRect(ox * zoom + p.x * zoom, oy * zoom + p.y * zoom, zoom, zoom);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#bfff00";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(ox * zoom + 0.5, oy * zoom + 0.5, snippet.width * zoom - 1, snippet.height * zoom - 1);
  ctx.setLineDash([]);
}
