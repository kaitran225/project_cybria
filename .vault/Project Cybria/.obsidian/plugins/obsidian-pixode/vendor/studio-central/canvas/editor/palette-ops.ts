import type { PaletteEntry, PixelAssetDocument } from "@pixode/asset-core";

export function addPaletteColor(
  doc: PixelAssetDocument,
  entry: PaletteEntry,
  maxColors = 32
): PixelAssetDocument {
  if (doc.palette.length >= maxColors) return doc;
  if (doc.palette.some((p) => p.id === entry.id)) return doc;
  return { ...doc, palette: [...doc.palette, entry] };
}

export function deletePaletteColor(
  doc: PixelAssetDocument,
  colorId: number
): PixelAssetDocument {
  if (doc.palette.length <= 1) return doc;
  const palette = doc.palette.filter((p) => p.id !== colorId);
  const layers = doc.layers.map((l) => ({
    ...l,
    pixels: l.pixels.filter((px) => px.c !== colorId),
  }));
  return { ...doc, palette, layers };
}

export function replacePaletteColor(
  doc: PixelAssetDocument,
  fromId: number,
  toId: number
): PixelAssetDocument {
  const layers = doc.layers.map((l) => ({
    ...l,
    pixels: l.pixels.map((px) =>
      px.c === fromId ? { ...px, c: toId } : px
    ),
  }));
  return { ...doc, layers };
}

export function updatePaletteEntry(
  doc: PixelAssetDocument,
  entry: PaletteEntry
): PixelAssetDocument {
  return {
    ...doc,
    palette: doc.palette.map((p) => (p.id === entry.id ? entry : p)),
  };
}

export function nextPaletteId(doc: PixelAssetDocument): number {
  const ids = doc.palette.map((p) => p.id);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}
