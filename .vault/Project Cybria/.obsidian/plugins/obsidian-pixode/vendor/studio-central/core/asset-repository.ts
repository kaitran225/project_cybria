import type { AnimationGraph, PaletteEntry, PixelAssetDocument, SparsePixel } from "@pixode/asset-core";
import { serialize } from "@pixode/asset-core";
import { validate } from "@pixode/quality";
import type { SaveAssetResult } from "./types.js";
import type { FileSystemAdapter } from "./fs/adapter.js";
import type { StateStore } from "../state/index.js";
import { resolveUnderRoot } from "./paths.js";
import {
  mutateAddLayer,
  mutateSetPixels,
  mutateRemovePixels,
  mutateUpdatePalette,
  mutateUpdateAnimations,
} from "./mutations.js";

export async function writeAssetFile(
  fs: FileSystemAdapter,
  rootPath: string,
  relPath: string,
  doc: PixelAssetDocument,
  assetCache: Map<string, PixelAssetDocument>
): Promise<void> {
  const fullPath = resolveUnderRoot(rootPath, relPath);
  await fs.writeText(fullPath, serialize(doc));
  assetCache.set(doc.id, doc);
}

export async function updateAssetDocument(
  fs: FileSystemAdapter,
  rootPath: string,
  store: StateStore,
  assetCache: Map<string, PixelAssetDocument>,
  assetId: string,
  doc: PixelAssetDocument,
  options?: { rescan?: boolean; rescanProject?: (root: string) => Promise<void> }
): Promise<SaveAssetResult> {
  const row = store.getAsset(assetId);
  if (!row) throw new Error(`Asset not indexed: ${assetId}`);

  const validation = validate(doc);
  const warnings = validation.ok ? [] : validation.errors.map((e) => e.message);

  await writeAssetFile(fs, rootPath, row.path, doc, assetCache);

  if (options?.rescan && options.rescanProject) {
    await options.rescanProject(rootPath);
  } else {
    assetCache.set(assetId, doc);
    const indexed = store.getAsset(assetId);
    if (indexed) {
      store.upsertAsset({
        ...indexed,
        reviewStatus: doc.review?.status ?? indexed.reviewStatus,
        blueprintId: doc.blueprintRef?.blueprintId ?? indexed.blueprintId,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return { ok: validation.ok, warnings };
}

export function requireCachedAsset(
  assetCache: Map<string, PixelAssetDocument>,
  assetId: string
): PixelAssetDocument {
  const doc = assetCache.get(assetId);
  if (!doc) throw new Error(`Asset not found: ${assetId}`);
  return doc;
}

export const assetMutations = {
  addLayer: (doc: PixelAssetDocument, layerId: string, name: string) =>
    mutateAddLayer(doc, layerId, name),
  setPixels: (doc: PixelAssetDocument, layerId: string, pixels: SparsePixel[]) =>
    mutateSetPixels(doc, layerId, pixels),
  removePixels: (
    doc: PixelAssetDocument,
    layerId: string,
    positions: Array<{ x: number; y: number }>
  ) => mutateRemovePixels(doc, layerId, positions),
  updatePalette: (doc: PixelAssetDocument, palette: PaletteEntry[]) =>
    mutateUpdatePalette(doc, palette),
  updateAnimations: (doc: PixelAssetDocument, animations: AnimationGraph) =>
    mutateUpdateAnimations(doc, animations),
};
