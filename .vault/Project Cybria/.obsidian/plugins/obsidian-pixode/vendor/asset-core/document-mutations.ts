import type {
  Animation,
  AnimationGraph,
  PaletteEntry,
  PixelAssetDocument,
  Region,
  SparsePixel,
} from "./types.js";

export function addLayer(
  doc: PixelAssetDocument,
  layerId: string,
  name: string,
  visible = true
): PixelAssetDocument {
  if (doc.layers.some((l) => l.id === layerId)) return doc;
  return {
    ...doc,
    layers: [...doc.layers, { id: layerId, name, visible, pixels: [] }],
  };
}

export function setPixels(
  doc: PixelAssetDocument,
  layerId: string,
  pixels: SparsePixel[]
): PixelAssetDocument {
  const layerIdx = doc.layers.findIndex((l) => l.id === layerId);
  if (layerIdx === -1) return doc;

  const pixelMap = new Map<string, SparsePixel>();
  for (const px of doc.layers[layerIdx].pixels) {
    pixelMap.set(`${px.x},${px.y}`, px);
  }
  for (const px of pixels) {
    pixelMap.set(`${px.x},${px.y}`, px);
  }

  const layers = [...doc.layers];
  layers[layerIdx] = { ...layers[layerIdx], pixels: [...pixelMap.values()] };
  return { ...doc, layers };
}

export function removePixels(
  doc: PixelAssetDocument,
  layerId: string,
  positions: Array<{ x: number; y: number }>
): PixelAssetDocument {
  const layerIdx = doc.layers.findIndex((l) => l.id === layerId);
  if (layerIdx === -1) return doc;

  const removeSet = new Set(positions.map((p) => `${p.x},${p.y}`));
  const layers = [...doc.layers];
  layers[layerIdx] = {
    ...layers[layerIdx],
    pixels: layers[layerIdx].pixels.filter(
      (px) => !removeSet.has(`${px.x},${px.y}`)
    ),
  };
  return { ...doc, layers };
}

export function defineRegion(
  doc: PixelAssetDocument,
  region: Region
): PixelAssetDocument {
  const regions = doc.regions.filter((r) => r.id !== region.id);
  regions.push(region);
  return { ...doc, regions };
}

export function createAnimation(
  doc: PixelAssetDocument,
  animation: Animation
): PixelAssetDocument {
  const states = (doc.animations?.states ?? []).filter(
    (s) => s.id !== animation.id
  );
  states.push(animation);
  return {
    ...doc,
    animations: {
      ...doc.animations,
      states,
      transitions: doc.animations?.transitions ?? [],
    },
  };
}

export function addPaletteColor(
  doc: PixelAssetDocument,
  entry: PaletteEntry
): PixelAssetDocument {
  if (doc.palette.some((p) => p.id === entry.id)) return doc;
  return { ...doc, palette: [...doc.palette, entry] };
}

export function updatePalette(
  doc: PixelAssetDocument,
  palette: PaletteEntry[]
): PixelAssetDocument {
  return { ...doc, palette };
}

export function updateAnimations(
  doc: PixelAssetDocument,
  animations: AnimationGraph
): PixelAssetDocument {
  return { ...doc, animations };
}

export const mutateAddLayer = addLayer;
export const mutateSetPixels = setPixels;
export const mutateRemovePixels = removePixels;
export const mutateUpdatePalette = updatePalette;
export const mutateUpdateAnimations = updateAnimations;
