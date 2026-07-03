import type { PixelAssetDocument } from "@pixode/asset-core";
import { serialize } from "@pixode/asset-core";
import { analyzeProject, aggregate, type AnalyticsEvent } from "@pixode/quality";
import { generateVariantSet, parseVariantSet } from "@pixode/design";
import type { StudioCategory } from "./types.js";
import type { FileSystemAdapter } from "./fs/adapter.js";
import type { StateStore, IndexedAsset } from "../state/index.js";
import { resolveUnderRoot } from "./paths.js";
import { mapCategoryFilter } from "./studio-utils.js";

export function analyzeConsistency(
  assetCache: Map<string, PixelAssetDocument>,
  store: StateStore,
  category?: StudioCategory
) {
  const filter = mapCategoryFilter(category);
  let docs = [...assetCache.values()];
  if (filter) {
    const ids = new Set(store.getAssets(filter).map((a: IndexedAsset) => a.id));
    docs = docs.filter((d) => ids.has(d.id));
  }
  return analyzeProject(docs);
}

export async function generateVariants(
  fs: FileSystemAdapter,
  rootPath: string,
  assetCache: Map<string, PixelAssetDocument>,
  baseId: string,
  variantSetPath: string,
  rescanProject: (root: string) => Promise<void>
): Promise<string[]> {
  const base = assetCache.get(baseId);
  if (!base) throw new Error(`Base asset not found: ${baseId}`);

  const fullSetPath =
    variantSetPath.startsWith("/") || /^[A-Za-z]:/.test(variantSetPath)
      ? variantSetPath
      : fs.join(rootPath, variantSetPath);
  const setJson = await fs.readText(fullSetPath);
  const set = parseVariantSet(setJson);
  const variants = generateVariantSet(base, set);
  const ids: string[] = [];

  for (const variant of variants) {
    const relPath = fs.join("assets", "variants", `${variant.id}.pixelasset.json`);
    await fs.writeText(
      resolveUnderRoot(rootPath, relPath),
      serialize(variant)
    );
    ids.push(variant.id);
  }

  await rescanProject(rootPath);
  return ids;
}

export async function getAnalytics(fs: FileSystemAdapter, rootPath: string) {
  if (!rootPath) return aggregate([]);
  const eventsPath = fs.join(rootPath, ".pixode", "events.jsonl");
  if (!(await fs.exists(eventsPath))) return aggregate([]);

  const text = await fs.readText(eventsPath);
  const events: AnalyticsEvent[] = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return aggregate(events);
}
