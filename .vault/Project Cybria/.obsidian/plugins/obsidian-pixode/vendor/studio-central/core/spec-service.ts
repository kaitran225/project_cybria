import type { AssetSpecification } from "@pixode/design";
import type { StudioSpecForm } from "./types.js";
import type { FileSystemAdapter } from "./fs/adapter.js";
import { displayName, specFormToSpec, specToForm } from "./studio-utils.js";

export async function saveSpecification(
  fs: FileSystemAdapter,
  rootPath: string,
  specCache: Map<string, { spec: AssetSpecification; path: string }>,
  form: StudioSpecForm
): Promise<string> {
  const spec = specFormToSpec(form);
  const relPath = fs.join("specs", `${form.id.replace(/_/g, "-")}.pixelspec.json`);
  const fullPath = fs.join(rootPath, relPath);
  await fs.writeText(fullPath, JSON.stringify(spec, null, 2) + "\n");
  specCache.set(spec.id, { spec, path: relPath });
  return spec.id;
}

export function getSpecForm(
  specCache: Map<string, { spec: AssetSpecification; path: string }>,
  specId: string
): StudioSpecForm | null {
  const entry = specCache.get(specId);
  if (!entry) return null;
  return specToForm(entry.spec);
}

export function getSpecification(
  specCache: Map<string, { spec: AssetSpecification; path: string }>,
  specId: string
): AssetSpecification | null {
  return specCache.get(specId)?.spec ?? null;
}

export function listSpecs(
  specCache: Map<string, { spec: AssetSpecification; path: string }>
): Array<{ id: string; displayName: string; category: string }> {
  return [...specCache.entries()].map(([id, entry]) => ({
    id,
    displayName: displayName(id),
    category: entry.spec.category,
  }));
}
