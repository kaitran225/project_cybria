import type { AssetCatalogEntry, PixelProject } from "@pixode/asset-core/project";
import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetSpecification } from "@pixode/design";
import { parseProject } from "@pixode/asset-core/project";
import { parseSpec } from "@pixode/design";
import type { FileSystemAdapter } from "./fs/adapter.js";
import { toRelativePath } from "./paths.js";

export interface ScannedAsset {
  assetId: string;
  path: string;
  category: string;
  specId?: string;
  status: "draft" | "approved" | "exported";
  document: PixelAssetDocument;
}

export interface ScannedSpec {
  specId: string;
  path: string;
  specification: AssetSpecification;
}

export interface ScanResult {
  project: PixelProject;
  assets: ScannedAsset[];
  specs: ScannedSpec[];
  catalog: AssetCatalogEntry[];
}

function categoryFromPath(relativePath: string, docCategory?: string): string {
  if (docCategory) return docCategory;
  const lower = relativePath.toLowerCase();
  if (lower.includes("/enemies/") || lower.includes("/enemy/")) return "enemy";
  if (lower.includes("/characters/") || lower.includes("/character/")) return "character";
  if (lower.includes("/items/") || lower.includes("/item/")) return "item";
  if (lower.includes("/tilesets/") || lower.includes("/tileset/")) return "tileset";
  if (lower.includes("/ui/")) return "ui_icon";
  return "enemy";
}

function mapReviewStatus(doc: PixelAssetDocument): "draft" | "approved" | "exported" {
  const status = doc.review?.status;
  if (status === "approved") return "approved";
  return "draft";
}

async function walkFiles(
  fs: FileSystemAdapter,
  dir: string,
  ext: string
): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.listDir(dir);
  for (const entry of entries) {
    const full = fs.join(dir, entry);
    const st = await fs.stat(full);
    if (!st) continue;
    if (st.isDirectory) {
      results.push(...(await walkFiles(fs, full, ext)));
    } else if (entry.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

export async function scanProject(
  fs: FileSystemAdapter,
  rootPath: string
): Promise<ScanResult> {
  const manifestPath = fs.join(rootPath, "pixode.project.json");
  if (!(await fs.exists(manifestPath))) {
    throw new Error(
      `Not a Pixode project (pixode.project.json not found in ${rootPath})`
    );
  }
  const projectJson = await fs.readText(manifestPath);
  const project = parseProject(projectJson);

  const assetPaths = await walkFiles(fs, rootPath, ".pixelasset.json");
  const specPaths = await walkFiles(fs, rootPath, ".pixelspec.json");

  const specs: ScannedSpec[] = [];
  for (const specPath of specPaths) {
    const json = await fs.readText(specPath);
    const specification = parseSpec(json);
    specs.push({
      specId: specification.id,
      path: toRelativePath(rootPath, specPath),
      specification,
    });
  }

  const specById = new Map(specs.map((s) => [s.specId, s]));

  const assets: ScannedAsset[] = [];
  const catalogById = new Map(
    project.assetCatalog.map((e) => [e.assetId, e])
  );

  for (const assetPath of assetPaths) {
    const json = await fs.readText(assetPath);
    const document = JSON.parse(json) as PixelAssetDocument;
    const relative = toRelativePath(rootPath, assetPath);
    const existing = catalogById.get(document.id);
    const specId =
      existing?.specId ??
      document.specRef?.specId ??
      specs.find((s) => s.specification.species && document.id.includes(s.specification.species))?.specId;

    assets.push({
      assetId: document.id,
      path: relative,
      category: existing?.category ?? categoryFromPath(relative),
      specId,
      status: existing?.status ?? mapReviewStatus(document),
      document,
    });
  }

  const catalog: AssetCatalogEntry[] = assets.map((a) => ({
    assetId: a.assetId,
    specId: a.specId,
    path: a.path,
    category: a.category,
    status: a.status,
  }));

  return {
    project: { ...project, assetCatalog: catalog },
    assets,
    specs,
    catalog,
  };
}

export async function updateProjectCatalog(
  fs: FileSystemAdapter,
  rootPath: string,
  catalog: AssetCatalogEntry[]
): Promise<void> {
  const manifestPath = fs.join(rootPath, "pixode.project.json");
  const projectJson = await fs.readText(manifestPath);
  const project = parseProject(projectJson);
  const updated = { ...project, assetCatalog: catalog };
  await fs.writeText(manifestPath, JSON.stringify(updated, null, 2) + "\n");
}
