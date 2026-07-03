import type { PixelAssetDocument, SparsePixel, PaletteEntry } from "@pixode/asset-core";
import type { AssetDiff } from "./types.js";

function pixelKey(p: SparsePixel): string {
  return `${p.x},${p.y},${p.c}`;
}

export function diffDocuments(
  a: PixelAssetDocument,
  b: PixelAssetDocument
): AssetDiff {
  const diff: AssetDiff = {
    paletteAdded: [],
    paletteRemoved: [],
    paletteChanged: [],
    pixelsAdded: {},
    pixelsRemoved: {},
    layersAdded: [],
    layersRemoved: [],
    regionsChanged: [],
    animationsChanged: [],
    designChanged: false,
    metadataChanged: false,
    reviewChanged: false,
    generationChanged: false,
  };

  // Palette diff
  const aPaletteMap = new Map(a.palette.map((p) => [p.id, p]));
  const bPaletteMap = new Map(b.palette.map((p) => [p.id, p]));

  for (const [id, entry] of bPaletteMap) {
    if (!aPaletteMap.has(id)) {
      diff.paletteAdded.push(entry);
    } else {
      const aEntry = aPaletteMap.get(id)!;
      if (aEntry.hex !== entry.hex) {
        diff.paletteChanged.push({ id, from: aEntry.hex, to: entry.hex });
      }
    }
  }
  for (const [id, entry] of aPaletteMap) {
    if (!bPaletteMap.has(id)) {
      diff.paletteRemoved.push(entry);
    }
  }

  // Layer diff
  const aLayerIds = new Set(a.layers.map((l) => l.id));
  const bLayerIds = new Set(b.layers.map((l) => l.id));

  for (const id of bLayerIds) {
    if (!aLayerIds.has(id)) diff.layersAdded.push(id);
  }
  for (const id of aLayerIds) {
    if (!bLayerIds.has(id)) diff.layersRemoved.push(id);
  }

  // Pixel diff per layer
  const aLayerMap = new Map(a.layers.map((l) => [l.id, l]));
  const bLayerMap = new Map(b.layers.map((l) => [l.id, l]));

  for (const [layerId, bLayer] of bLayerMap) {
    const aLayer = aLayerMap.get(layerId);
    const aPixels = new Set((aLayer?.pixels ?? []).map(pixelKey));
    const bPixels = new Set(bLayer.pixels.map(pixelKey));

    const added = bLayer.pixels.filter((p) => !aPixels.has(pixelKey(p)));
    const removed = (aLayer?.pixels ?? []).filter(
      (p) => !bPixels.has(pixelKey(p))
    );

    if (added.length > 0) diff.pixelsAdded[layerId] = added;
    if (removed.length > 0) diff.pixelsRemoved[layerId] = removed;
  }

  for (const [layerId, aLayer] of aLayerMap) {
    if (!bLayerMap.has(layerId)) {
      diff.pixelsRemoved[layerId] = [...aLayer.pixels];
    }
  }

  // Region diff
  const aRegionMap = new Map((a.regions ?? []).map((r) => [r.id, r]));
  const bRegionMap = new Map((b.regions ?? []).map((r) => [r.id, r]));

  for (const [id, bRegion] of bRegionMap) {
    const aRegion = aRegionMap.get(id);
    if (!aRegion || JSON.stringify(aRegion) !== JSON.stringify(bRegion)) {
      diff.regionsChanged.push(id);
    }
  }
  for (const id of aRegionMap.keys()) {
    if (!bRegionMap.has(id)) diff.regionsChanged.push(id);
  }

  // Animation diff
  const aAnimIds = new Set((a.animations?.states ?? []).map((s) => s.id));
  const bAnimIds = new Set((b.animations?.states ?? []).map((s) => s.id));
  const aAnimMap = new Map((a.animations?.states ?? []).map((s) => [s.id, s]));
  const bAnimMap = new Map((b.animations?.states ?? []).map((s) => [s.id, s]));

  for (const id of bAnimIds) {
    const aAnim = aAnimMap.get(id);
    const bAnim = bAnimMap.get(id);
    if (!aAnim || JSON.stringify(aAnim) !== JSON.stringify(bAnim)) {
      diff.animationsChanged.push(id);
    }
  }
  for (const id of aAnimIds) {
    if (!bAnimIds.has(id)) diff.animationsChanged.push(id);
  }

  diff.designChanged = JSON.stringify(a.design) !== JSON.stringify(b.design);
  diff.metadataChanged =
    JSON.stringify(a.metadata) !== JSON.stringify(b.metadata);
  diff.reviewChanged = JSON.stringify(a.review) !== JSON.stringify(b.review);
  diff.generationChanged =
    JSON.stringify(a.generation) !== JSON.stringify(b.generation);

  return diff;
}
