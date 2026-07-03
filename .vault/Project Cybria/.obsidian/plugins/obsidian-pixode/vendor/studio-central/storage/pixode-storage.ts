import type { PaletteEntry } from "@pixode/asset-core";
import {
  compressPixels,
  decompressPixels,
  shouldCompress,
} from "./rle.js";
import type {
  PaletteCollection,
  PaletteColor,
  PixelSnippet,
  PixelSnippetExport,
  PixPaletteExport,
  SavedPalette,
} from "./types.js";

const KEYS = {
  palettes: "pixode.palettes.v1",
  collections: "pixode.palette-collections.v1",
  snippets: "pixode.snippets.v1",
} as const;

type StorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

let backend: StorageBackend = {
  getItem: (k) => (typeof localStorage !== "undefined" ? localStorage.getItem(k) : null),
  setItem: (k, v) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
  },
};

export function setStorageBackend(b: StorageBackend): void {
  backend = b;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = backend.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  backend.setItem(key, JSON.stringify(value));
}

function newId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ---- Palettes ----

export function getPalettes(): SavedPalette[] {
  return loadJson<SavedPalette[]>(KEYS.palettes, []);
}

export function getPalette(id: string): SavedPalette | undefined {
  return getPalettes().find((p) => p.id === id);
}

export function savePalette(palette: SavedPalette): SavedPalette {
  const list = getPalettes();
  const idx = list.findIndex((p) => p.id === palette.id);
  const next = { ...palette, updatedAt: now() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveJson(KEYS.palettes, list);
  return next;
}

export function createPalette(
  name: string,
  colors: PaletteColor[] = [],
  collectionId?: string
): SavedPalette {
  const palette: SavedPalette = {
    id: newId(),
    name,
    colors,
    createdAt: now(),
    updatedAt: now(),
    ...(collectionId ? { collectionId } : {}),
  };
  const saved = savePalette(palette);
  if (collectionId) {
    movePaletteToCollection(saved.id, collectionId);
  }
  return saved;
}

export function renamePalette(id: string, name: string): SavedPalette | null {
  const p = getPalette(id);
  if (!p) return null;
  return savePalette({ ...p, name });
}

export function deletePalette(id: string): boolean {
  const list = getPalettes().filter((p) => p.id !== id);
  if (list.length === getPalettes().length) return false;
  saveJson(KEYS.palettes, list);
  const cols = getCollections().map((c) => ({
    ...c,
    paletteIds: c.paletteIds.filter((pid) => pid !== id),
  }));
  saveJson(KEYS.collections, cols);
  return true;
}

export function paletteFromDocument(name: string, entries: PaletteEntry[]): SavedPalette {
  const colors: PaletteColor[] = entries.map((e) => ({
    id: e.id,
    hex: e.hex,
    name: e.role,
  }));
  return createPalette(name, colors);
}

export function documentPaletteFromSaved(palette: SavedPalette): PaletteEntry[] {
  return palette.colors.map((c) => ({
    id: c.id,
    hex: c.hex,
    ...(c.name ? { role: c.name } : {}),
  }));
}

export function exportPalette(id: string): PixPaletteExport | null {
  const p = getPalette(id);
  if (!p) return null;
  return {
    format: "pixpalette",
    version: "1.0.0",
    name: p.name,
    colors: p.colors.map((c) => c.hex),
    collectionId: p.collectionId,
    meta: { created: p.createdAt, updated: p.updatedAt },
  };
}

export function importPalette(
  json: PixPaletteExport | string,
  collectionId?: string
): SavedPalette {
  const data = typeof json === "string" ? (JSON.parse(json) as PixPaletteExport) : json;
  const colors: PaletteColor[] = data.colors.map((hex, i) => ({
    id: i,
    hex: hex.toLowerCase(),
  }));
  const targetCollection = data.collectionId ?? collectionId;
  return createPalette(data.name, colors, targetCollection);
}

// ---- Collections ----

export function getCollections(): PaletteCollection[] {
  const cols = loadJson<PaletteCollection[]>(KEYS.collections, []);
  if (cols.length === 0) {
    const defaultCol: PaletteCollection = {
      id: "default",
      name: "Default",
      paletteIds: getPalettes().map((p) => p.id),
    };
    saveJson(KEYS.collections, [defaultCol]);
    return [defaultCol];
  }
  return cols;
}

export function saveCollection(collection: PaletteCollection): PaletteCollection {
  const list = getCollections();
  const idx = list.findIndex((c) => c.id === collection.id);
  if (idx >= 0) list[idx] = collection;
  else list.push(collection);
  saveJson(KEYS.collections, list);
  return collection;
}

export function createCollection(name: string): PaletteCollection {
  return saveCollection({ id: newId(), name, paletteIds: [] });
}

export function renameCollection(id: string, name: string): PaletteCollection | null {
  const col = getCollections().find((c) => c.id === id);
  if (!col) return null;
  return saveCollection({ ...col, name });
}

export function deleteCollection(id: string): boolean {
  if (id === "default") return false;
  const cols = getCollections();
  const target = cols.find((c) => c.id === id);
  if (!target) return false;

  const paletteIds = [...target.paletteIds];
  for (const paletteId of paletteIds) {
    movePaletteToCollection(paletteId, "default");
  }

  saveJson(
    KEYS.collections,
    getCollections().filter((c) => c.id !== id)
  );
  return true;
}

export function movePaletteToCollection(
  paletteId: string,
  collectionId: string
): void {
  const palettes = getPalettes();
  const p = palettes.find((x) => x.id === paletteId);
  if (!p) return;
  savePalette({ ...p, collectionId });

  const cols = getCollections().map((c) => ({
    ...c,
    paletteIds:
      c.id === collectionId
        ? [...new Set([...c.paletteIds, paletteId])]
        : c.paletteIds.filter((id) => id !== paletteId),
  }));
  saveJson(KEYS.collections, cols);
}

// ---- Snippets ----

export function getSnippets(): PixelSnippet[] {
  return loadJson<PixelSnippet[]>(KEYS.snippets, []);
}

export function getSnippet(id: string): PixelSnippet | undefined {
  return getSnippets().find((s) => s.id === id);
}

export function saveSnippet(snippet: PixelSnippet): PixelSnippet {
  const list = getSnippets();
  let next = { ...snippet };
  if (shouldCompress(snippet.width, snippet.height) && !snippet.compressed) {
    next = {
      ...snippet,
      compressed: true,
      compressedData: compressPixels(snippet.width, snippet.height, snippet.pixels),
      pixels: [],
    };
  }
  const idx = list.findIndex((s) => s.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveJson(KEYS.snippets, list);
  return next;
}

export function createSnippet(
  input: Omit<PixelSnippet, "id" | "createdAt">
): PixelSnippet {
  const snippet: PixelSnippet = {
    ...input,
    id: newId(),
    createdAt: now(),
  };
  return saveSnippet(snippet);
}

export function renameSnippet(id: string, name: string): PixelSnippet | null {
  const s = getSnippet(id);
  if (!s) return null;
  return saveSnippet({ ...s, name });
}

export function deleteSnippet(id: string): boolean {
  const list = getSnippets().filter((s) => s.id !== id);
  if (list.length === getSnippets().length) return false;
  saveJson(KEYS.snippets, list);
  return true;
}

export function exportSnippet(id: string): PixelSnippetExport | null {
  const s = getSnippet(id);
  if (!s) return null;
  const pixels = s.compressed && s.compressedData
    ? decompressPixels(s.compressedData)
    : s.pixels;
  return {
    format: "pixelsnippet",
    version: "1.0.0",
    id: s.id,
    name: s.name,
    width: s.width,
    height: s.height,
    pixels,
    paletteRef: s.paletteRef,
    tags: s.tags,
    createdAt: s.createdAt,
  };
}

export function importSnippet(json: PixelSnippetExport | string): PixelSnippet {
  const data =
    typeof json === "string" ? (JSON.parse(json) as PixelSnippetExport) : json;
  return createSnippet({
    name: data.name,
    width: data.width,
    height: data.height,
    pixels: data.pixels,
    paletteRef: data.paletteRef,
    tags: data.tags,
  });
}

/** Remap snippet color IDs to document palette by hex lookup */
export function remapSnippetPixels(
  pixels: import("@pixode/asset-core").SparsePixel[],
  sourcePalette: PaletteColor[],
  targetPalette: PaletteEntry[]
): import("@pixode/asset-core").SparsePixel[] {
  const hexToTarget = new Map<string, number>();
  for (const t of targetPalette) {
    hexToTarget.set(t.hex.toLowerCase(), t.id);
  }
  const sourceIdToHex = new Map<number, string>();
  for (const s of sourcePalette) {
    sourceIdToHex.set(s.id, s.hex.toLowerCase());
  }

  let nextId = Math.max(0, ...targetPalette.map((p) => p.id)) + 1;
  const result: import("@pixode/asset-core").SparsePixel[] = [];

  for (const p of pixels) {
    const hex = sourceIdToHex.get(p.c);
    if (!hex) {
      result.push(p);
      continue;
    }
    let targetId = hexToTarget.get(hex);
    if (targetId === undefined) {
      targetId = nextId++;
      hexToTarget.set(hex, targetId);
    }
    result.push({ ...p, c: targetId });
  }
  return result;
}
