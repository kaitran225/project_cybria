import type { AssetCategory, AssetSize } from "@pixode/design";
import type { DirectorReport } from "../types/review.js";
import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetSpecification } from "@pixode/design";

export interface StudioProject {
  id: string;
  name: string;
  rootPath: string;
  stats: {
    characters: number;
    enemies: number;
    items: number;
    tilesets: number;
    ui: number;
    total: number;
  };
  reviewQueue: number;
  styleViolations: number;
  consistencyScore: number;
}

export interface StudioAssetSummary {
  id: string;
  category: string;
  displayName: string;
  thumbnailUrl: string;
  reviewStatus: string;
  directorScore?: number;
  specId?: string;
  path: string;
}

export interface StudioSpecForm {
  id: string;
  type: AssetCategory;
  species?: string;
  theme?: string;
  size?: AssetSize;
  faction?: string;
  styleId: string;
  outline: boolean;
  paletteTheme?: string;
  blueprintId: string;
  animations: string[];
}

export interface StudioAssetDetail {
  id: string;
  category: string;
  displayName: string;
  document: PixelAssetDocument;
  spec?: AssetSpecification;
  specPath?: string;
  assetPath: string;
  reviewReport?: DirectorReport;
  generationInfo?: {
    specId?: string;
    backend?: string;
    seed?: number;
  };
}

export interface StudioBrainOptions {
  species: string[];
  themes: string[];
  factions: string[];
  blueprintIds: string[];
  styleIds: string[];
}

export type StudioCategory =
  | "character"
  | "enemy"
  | "item"
  | "tileset"
  | "ui"
  | "all";

export interface StudioCanvasContext {
  assetId: string;
  document: import("@pixode/asset-core").PixelAssetDocument;
  activeLayerId: string;
  activeFrameIndex: number;
  activeColorId: number;
}

export interface SaveAssetResult {
  ok: boolean;
  warnings: string[];
}
