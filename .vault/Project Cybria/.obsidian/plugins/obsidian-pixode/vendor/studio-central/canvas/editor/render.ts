import { compileToRaster, type RasterGrid } from "@pixode/design/compiler";
import type { PixelAssetDocument } from "@pixode/asset-core";
import { getActiveFrameLayerIds } from "./animation-ops.js";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function renderDocumentToImageData(
  doc: PixelAssetDocument,
  animId?: string,
  frameIndex = 0
): ImageData {
  const frameDoc = docForFrame(doc, animId, frameIndex);
  // Layer list is already scoped to this frame; compile as a static composite.
  const compiled = compileToRaster({ ...frameDoc, animations: EMPTY_ANIMATIONS });
  const grid = compiled.frames[0]?.grid;
  if (!grid) {
    return new ImageData(doc.canvas.width, doc.canvas.height);
  }
  return rasterToImageData(grid, doc);
}

function docForFrame(
  doc: PixelAssetDocument,
  animId?: string,
  frameIndex = 0
): PixelAssetDocument {
  const layerIds = getActiveFrameLayerIds(
    doc,
    animId ?? doc.animations?.states[0]?.id ?? "idle",
    frameIndex
  );
  const layerSet = new Set(layerIds);
  return {
    ...doc,
    layers: doc.layers.filter((l) => layerSet.has(l.id)),
  };
}

function rasterToImageData(
  grid: RasterGrid,
  doc: PixelAssetDocument
): ImageData {
  const { width, height, pixels } = grid;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const px = pixels[i];
    const offset = i * 4;
    data[offset] = px.r;
    data[offset + 1] = px.g;
    data[offset + 2] = px.b;
    data[offset + 3] = Math.round(px.a * 255);
  }
  return new ImageData(data, width, height);
}

export function pickColorAt(
  doc: PixelAssetDocument,
  x: number,
  y: number,
  animId?: string,
  frameIndex = 0
): number | null {
  const layerIds = getActiveFrameLayerIds(
    doc,
    animId ?? doc.animations?.states[0]?.id ?? "idle",
    frameIndex
  );
  for (let i = layerIds.length - 1; i >= 0; i--) {
    const layer = doc.layers.find((l) => l.id === layerIds[i]);
    if (!layer?.visible) continue;
    const px = layer.pixels.find((p) => p.x === x && p.y === y);
    if (px) return px.c;
  }
  return null;
}

export function mirrorX(x: number, width: number): number {
  return width - 1 - x;
}

const EMPTY_ANIMATIONS = { states: [], transitions: [] };

function renderLayersDocToImageData(doc: PixelAssetDocument): ImageData {
  const compiled = compileToRaster({ ...doc, animations: EMPTY_ANIMATIONS });
  const grid = compiled.frames[0]?.grid;
  if (!grid) {
    return new ImageData(doc.canvas.width, doc.canvas.height);
  }
  return rasterToImageData(grid, doc);
}

export function renderLayerToImageData(
  doc: PixelAssetDocument,
  layerId: string,
  _animId?: string,
  _frameIndex = 0
): ImageData {
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) {
    return new ImageData(doc.canvas.width, doc.canvas.height);
  }
  return renderLayersDocToImageData({ ...doc, layers: [layer] });
}

export function renderDocumentWithReferenceGhost(
  doc: PixelAssetDocument,
  activeLayerId: string,
  ghostOpacity: number,
  animId?: string,
  frameIndex = 0
): ImageData {
  const frameDoc = docForFrame(doc, animId, frameIndex);
  const { width, height } = frameDoc.canvas;
  const empty = new ImageData(width, height);

  const ghostLayers = frameDoc.layers.filter(
    (l) => l.id !== activeLayerId && l.visible
  );
  const activeLayers = frameDoc.layers.filter(
    (l) => l.id === activeLayerId && l.visible
  );

  let result = empty;
  if (ghostLayers.length > 0) {
    const ghostImg = renderLayersDocToImageData({
      ...frameDoc,
      layers: ghostLayers,
    });
    result = compositeImageData(result, ghostImg, ghostOpacity);
  }
  if (activeLayers.length > 0) {
    const activeImg = renderLayersDocToImageData({
      ...frameDoc,
      layers: activeLayers,
    });
    result = compositeImageData(result, activeImg, 1);
  }
  return result;
}

function compositeImageData(
  base: ImageData,
  overlay: ImageData,
  alpha: number
): ImageData {
  const out = new ImageData(base.width, base.height);
  for (let i = 0; i < base.data.length; i += 4) {
    const br = base.data[i];
    const bg = base.data[i + 1];
    const bb = base.data[i + 2];
    const ba = base.data[i + 3] / 255;
    const or = overlay.data[i];
    const og = overlay.data[i + 1];
    const ob = overlay.data[i + 2];
    const oa = (overlay.data[i + 3] / 255) * alpha;
    const a = oa + ba * (1 - oa);
    if (a <= 0) continue;
    out.data[i] = Math.round((or * oa + br * ba * (1 - oa)) / a);
    out.data[i + 1] = Math.round((og * oa + bg * ba * (1 - oa)) / a);
    out.data[i + 2] = Math.round((ob * oa + bb * ba * (1 - oa)) / a);
    out.data[i + 3] = Math.round(a * 255);
  }
  return out;
}

export function renderOnionFrames(
  doc: PixelAssetDocument,
  animId: string,
  frameIndex: number,
  prevCount = 1,
  nextCount = 1,
  opacity = 0.35
): ImageData {
  let result = renderDocumentToImageData(doc, animId, frameIndex);
  const states = doc.animations?.states ?? [];
  const anim = states.find((s) => s.id === animId);
  const frameCount = anim?.frames.length ?? 1;

  for (let i = 1; i <= prevCount; i++) {
    const fi = frameIndex - i;
    if (fi < 0) continue;
    const layer = renderDocumentToImageData(doc, animId, fi);
    result = compositeImageData(result, layer, opacity / i);
  }
  for (let i = 1; i <= nextCount; i++) {
    const fi = frameIndex + i;
    if (fi >= frameCount) continue;
    const layer = renderDocumentToImageData(doc, animId, fi);
    result = compositeImageData(result, layer, opacity / i);
  }
  return result;
}
