import type { PaletteEntry, SparsePixel } from "@pixode/asset-core";
import type { PaletteColor } from "../../storage/index.js";

export function getMissingSnippetHexes(
  pixels: SparsePixel[],
  sourcePalette: PaletteColor[],
  documentPalette: PaletteEntry[]
): string[] {
  const docHexes = new Set(documentPalette.map((p) => p.hex.toLowerCase()));
  const sourceIdToHex = new Map(
    sourcePalette.map((c) => [c.id, c.hex.toLowerCase()])
  );
  const missing = new Set<string>();
  for (const p of pixels) {
    const hex = sourceIdToHex.get(p.c);
    if (hex && !docHexes.has(hex)) missing.add(hex);
  }
  return [...missing];
}

export function addMissingColorsToPalette(
  documentPalette: PaletteEntry[],
  missingHexes: string[]
): PaletteEntry[] {
  const existing = new Set(documentPalette.map((p) => p.hex.toLowerCase()));
  let nextId = Math.max(-1, ...documentPalette.map((p) => p.id)) + 1;
  const added: PaletteEntry[] = [];
  for (const hex of missingHexes) {
    const lower = hex.toLowerCase();
    if (existing.has(lower)) continue;
    added.push({ id: nextId++, hex });
    existing.add(lower);
  }
  return [...documentPalette, ...added];
}
