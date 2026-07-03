import type { PaletteEntry } from "../types.js";

export interface LoreEntry {
  id: string;
  title: string;
  text: string;
  tags?: string[];
}

export interface Faction {
  id: string;
  name: string;
  palette?: PaletteEntry[];
  tags?: string[];
}

export interface Race {
  id: string;
  name: string;
  factionId?: string;
}

export interface VisualLanguage {
  outlineRequired: boolean;
  maxColorsPerAsset: number;
  forbiddenColors?: string[];
  silhouetteRules?: string[];
}

export interface ArtRule {
  id: string;
  rule: string;
  severity: "error" | "warning";
}

export interface NamingConvention {
  assetIdPattern: string;
  tagPrefixes: Record<string, string>;
}

export interface ProjectBrain {
  id: string;
  version: string;
  lore: LoreEntry[];
  factions: Faction[];
  races: Race[];
  visualLanguage: VisualLanguage;
  artRules: ArtRule[];
  naming: NamingConvention;
  biomePalettes?: Record<string, PaletteEntry[]>;
}

export interface ProjectBrainSlice {
  lore: LoreEntry[];
  factions: Faction[];
  races: Race[];
  visualLanguage: VisualLanguage;
  artRules: ArtRule[];
  biomePalette?: PaletteEntry[];
}

export interface AssetCatalogEntry {
  assetId: string;
  specId?: string;
  path: string;
  category?: string;
  status?: "draft" | "approved" | "exported";
}

export interface PixelProject {
  id: string;
  name: string;
  version: string;
  brainPath: string;
  defaultStyleId: string;
  assetCatalog: AssetCatalogEntry[];
}
