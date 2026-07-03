import type { PixelAssetDocument, PaletteEntry } from "@pixode/asset-core";
import type { VariantDefinition, VariantSet } from "./types.js";

export function applyVariant(
  base: PixelAssetDocument,
  def: VariantDefinition,
  variantSetId?: string
): PixelAssetDocument {
  const doc = structuredClone(base);
  const o = def.overrides;

  if (o.assetId) doc.id = o.assetId;
  else doc.id = def.id;

  if (o.paletteReplace) {
    doc.palette = o.paletteReplace.map((p) => ({ ...p }));
  }

  if (o.paletteRemap) {
    for (const layer of doc.layers) {
      for (const px of layer.pixels) {
        if (o.paletteRemap[px.c] !== undefined) {
          px.c = o.paletteRemap[px.c];
        }
      }
    }
  }

  if (o.layerRemove) {
    doc.layers = doc.layers.filter((l) => !o.layerRemove!.includes(l.id));
  }

  if (o.layerAdd) {
    doc.layers.push(...o.layerAdd.map((l) => structuredClone(l)));
  }

  if (o.layerPatch) {
    for (const patch of o.layerPatch) {
      const layer = doc.layers.find((l) => l.id === patch.layerId);
      if (!layer) continue;
      const map = new Map(layer.pixels.map((p) => [`${p.x},${p.y}`, p]));
      for (const px of patch.pixels) map.set(`${px.x},${px.y}`, px);
      layer.pixels = [...map.values()];
    }
  }

  if (o.designPatch) {
    doc.design = { ...doc.design, ...o.designPatch };
  }

  if (o.metadataTags) {
    doc.metadata = {
      ...doc.metadata,
      tags: [...new Set([...doc.metadata.tags, ...o.metadataTags])],
    };
  }

  doc.variantOf = {
    baseAssetId: def.baseAssetId,
    variantSetId: variantSetId ?? "default",
    variantId: def.id,
  };

  return doc;
}

export function generateVariantSet(
  base: PixelAssetDocument,
  set: VariantSet
): PixelAssetDocument[] {
  return set.variants.map((v) => applyVariant(base, v, set.id));
}

export function parseVariantSet(json: string): VariantSet {
  const data = JSON.parse(json);
  if (!data.id || !data.baseAssetId || !data.variants) {
    throw new Error("Invalid variant set");
  }
  return data as VariantSet;
}
