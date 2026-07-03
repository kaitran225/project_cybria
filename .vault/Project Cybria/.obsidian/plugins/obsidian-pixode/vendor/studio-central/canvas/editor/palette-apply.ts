import type { PaletteEntry, PixelAssetDocument } from "@pixode/asset-core";
import { nextPaletteId } from "./palette-ops.js";

/** Replace document palette and remap layer pixels by matching hex. */
export function replaceDocumentPalette(
  doc: PixelAssetDocument,
  entries: PaletteEntry[]
): PixelAssetDocument {
  const oldIdToHex = new Map(
    doc.palette.map((p) => [p.id, p.hex.toLowerCase()])
  );
  const hexToNewId = new Map(
    entries.map((e) => [e.hex.toLowerCase(), e.id])
  );

  const layers = doc.layers.map((layer) => ({
    ...layer,
    pixels: layer.pixels.map((px) => {
      const hex = oldIdToHex.get(px.c);
      if (!hex) return px;
      const newId = hexToNewId.get(hex);
      return newId !== undefined ? { ...px, c: newId } : px;
    }),
  }));

  return { ...doc, palette: entries, layers };
}

/** Add library colors missing from the document palette (by hex). */
export function mergeLibraryPaletteIntoDocument(
  doc: PixelAssetDocument,
  libraryEntries: PaletteEntry[]
): PixelAssetDocument {
  const existingHexes = new Set(doc.palette.map((p) => p.hex.toLowerCase()));
  let nextId = nextPaletteId(doc);
  const added: PaletteEntry[] = [];

  for (const entry of libraryEntries) {
    const hex = entry.hex.toLowerCase();
    if (existingHexes.has(hex)) continue;
    const newEntry: PaletteEntry = {
      id: nextId++,
      hex: entry.hex,
      ...(entry.role ? { role: entry.role } : {}),
    };
    added.push(newEntry);
    existingHexes.add(hex);
  }

  if (added.length === 0) return doc;
  return { ...doc, palette: [...doc.palette, ...added] };
}
