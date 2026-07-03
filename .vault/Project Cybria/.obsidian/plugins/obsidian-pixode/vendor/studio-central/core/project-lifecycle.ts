import { parseProject } from "@pixode/asset-core/project";
import type { PixelProject } from "@pixode/asset-core/project";
import type { FileSystemAdapter } from "./fs/adapter.js";

export async function appendToCatalog(
  fs: FileSystemAdapter,
  rootPath: string,
  assetId: string,
  path: string,
  category: string
): Promise<PixelProject> {
  const manifestPath = fs.join(rootPath, "pixode.project.json");
  const project = parseProject(await fs.readText(manifestPath));
  const catalog = [...(project.assetCatalog ?? [])];
  if (catalog.some((entry) => entry.assetId === assetId)) return project;
  catalog.push({
    assetId,
    path,
    category,
    status: "draft",
  });
  const updated = { ...project, assetCatalog: catalog };
  await fs.writeText(manifestPath, JSON.stringify(updated, null, 2) + "\n");
  return updated;
}

export async function findStylePath(
  fs: FileSystemAdapter,
  rootPath: string,
  styleId: string
): Promise<string> {
  const fileName = styleId.replace(/_/g, "-") + ".pixelstyle.json";
  const candidates = [
    fs.join(rootPath, "styles", fileName),
    fs.join(rootPath, "..", fileName),
  ];
  for (const p of candidates) {
    if (await fs.exists(p)) return p;
  }
  throw new Error(`Style not found: ${styleId}`);
}

export async function readProjectManifest(
  fs: FileSystemAdapter,
  rootPath: string,
  cached: PixelProject | null
): Promise<PixelProject> {
  if (cached) return cached;
  const manifest = await fs.readText(fs.join(rootPath, "pixode.project.json"));
  return parseProject(manifest);
}
