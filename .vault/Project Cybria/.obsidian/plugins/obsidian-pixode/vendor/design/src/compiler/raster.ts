import type {
  PixelAssetDocument,
  Layer,
  PaletteEntry,
  RasterPixel,
  RasterGrid,
  CompiledFrame,
  CompileResult,
} from "@pixode/asset-core";

export type { RasterPixel, RasterGrid, CompiledFrame, CompileResult };

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

function createEmptyGrid(w: number, h: number): RasterGrid {
  const pixels: RasterPixel[] = new Array(w * h);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = { r: 0, g: 0, b: 0, a: 0 };
  }
  return { width: w, height: h, pixels };
}

function buildPaletteMap(
  palette: PaletteEntry[]
): Map<number, { r: number; g: number; b: number }> {
  const map = new Map<number, { r: number; g: number; b: number }>();
  for (const entry of palette) {
    map.set(entry.id, hexToRgb(entry.hex));
  }
  return map;
}

function renderLayerToGrid(
  grid: RasterGrid,
  layer: Layer,
  paletteMap: Map<number, { r: number; g: number; b: number }>
): void {
  if (!layer.visible) return;

  const layerOpacity = layer.opacity ?? 1;
  for (const px of layer.pixels) {
    if (px.x < 0 || px.x >= grid.width || px.y < 0 || px.y >= grid.height) {
      continue;
    }
    const color = paletteMap.get(px.c);
    if (!color) continue;

    const alpha = (px.a ?? 1) * layerOpacity;
    const idx = px.y * grid.width + px.x;
    const dst = grid.pixels[idx];

    const srcA = alpha;
    const dstA = dst.a;
    const outA = srcA + dstA * (1 - srcA);

    if (outA > 0) {
      dst.r = Math.round((color.r * srcA + dst.r * dstA * (1 - srcA)) / outA);
      dst.g = Math.round((color.g * srcA + dst.g * dstA * (1 - srcA)) / outA);
      dst.b = Math.round((color.b * srcA + dst.b * dstA * (1 - srcA)) / outA);
      dst.a = outA;
    }
  }
}

/**
 * Compiles a PixelAssetDocument into raster grids.
 * If animations exist, produces one frame per animation frame.
 * Otherwise produces a single frame compositing all visible layers.
 */
export function compileToRaster(doc: PixelAssetDocument): CompileResult {
  const paletteMap = buildPaletteMap(doc.palette);
  const { width, height } = doc.canvas;
  const layerMap = new Map(doc.layers.map((l) => [l.id, l]));

  const frames: CompiledFrame[] = [];

  const animStates = doc.animations?.states ?? [];
  const allFrameDefs = animStates.flatMap((s) => s.frames);

  if (allFrameDefs.length === 0) {
    const grid = createEmptyGrid(width, height);
    for (const layer of doc.layers) {
      renderLayerToGrid(grid, layer, paletteMap);
    }
    frames.push({ index: 0, duration: 0, grid });
  } else {
    let frameIdx = 0;
    for (const frameDef of allFrameDefs) {
      const grid = createEmptyGrid(width, height);
      for (const layerId of frameDef.layerIds) {
        const layer = layerMap.get(layerId);
        if (layer) renderLayerToGrid(grid, layer, paletteMap);
      }
      frames.push({ index: frameIdx++, duration: frameDef.duration, grid });
    }
  }

  return { id: doc.id, canvas: { width, height }, frames };
}
