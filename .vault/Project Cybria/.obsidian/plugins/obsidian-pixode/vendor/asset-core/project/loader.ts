import type { ProjectBrain, PixelProject } from "./types.js";

export function parseBrain(json: string): ProjectBrain {
  const data = JSON.parse(json);
  return {
    id: data.id ?? "default",
    version: data.version ?? "1.0.0",
    lore: data.lore ?? [],
    factions: data.factions ?? [],
    races: data.races ?? [],
    visualLanguage: data.visualLanguage ?? {
      outlineRequired: true,
      maxColorsPerAsset: 16,
    },
    artRules: data.artRules ?? [],
    naming: data.naming ?? { assetIdPattern: "{theme}_{species}", tagPrefixes: {} },
    biomePalettes: data.biomePalettes,
  };
}

export function parseProject(json: string): PixelProject {
  const data = JSON.parse(json);
  if (!data.id || !data.defaultStyleId) {
    throw new Error("Invalid project: missing id or defaultStyleId");
  }
  return {
    id: data.id,
    name: data.name ?? data.id,
    version: data.version ?? "1.0.0",
    brainPath: data.brainPath ?? "brain",
    defaultStyleId: data.defaultStyleId,
    assetCatalog: data.assetCatalog ?? [],
  };
}
