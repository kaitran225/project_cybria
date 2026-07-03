import type { Layer, PixelAssetDocument } from "@pixode/asset-core";

export function createLayer(
  doc: PixelAssetDocument,
  layerId: string,
  name: string
): PixelAssetDocument {
  if (doc.layers.some((l) => l.id === layerId)) return doc;
  return {
    ...doc,
    layers: [...doc.layers, { id: layerId, name, visible: true, pixels: [] }],
  };
}

export function renameLayer(
  doc: PixelAssetDocument,
  layerId: string,
  name: string
): PixelAssetDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
  };
}

export function toggleLayerVisibility(
  doc: PixelAssetDocument,
  layerId: string
): PixelAssetDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ),
  };
}

export function deleteLayer(
  doc: PixelAssetDocument,
  layerId: string
): PixelAssetDocument {
  if (doc.layers.length <= 1) return doc;
  return {
    ...doc,
    layers: doc.layers.filter((l) => l.id !== layerId),
  };
}

export function reorderLayers(
  doc: PixelAssetDocument,
  fromIndex: number,
  toIndex: number
): PixelAssetDocument {
  const layers = [...doc.layers];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= layers.length || toIndex >= layers.length) {
    return doc;
  }
  const [item] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, item);
  return { ...doc, layers };
}

export function updateLayerPixels(
  doc: PixelAssetDocument,
  layerId: string,
  pixels: Layer["pixels"]
): PixelAssetDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.id === layerId ? { ...l, pixels } : l
    ),
  };
}

export function cloneLayer(layer: Layer, newId: string, name?: string): Layer {
  return {
    ...layer,
    id: newId,
    name: name ?? layer.name,
    pixels: layer.pixels.map((p) => ({ ...p })),
  };
}
