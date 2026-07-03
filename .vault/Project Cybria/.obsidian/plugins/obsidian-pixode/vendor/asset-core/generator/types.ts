import type { AssetSpecification, AssetBlueprint, PixelStyle } from "@pixode/design";
import type { ProjectBrainSlice } from "../project/types.js";
import type { PixelAssetDocument } from "../types.js";

export interface GenerationContext {
  spec: AssetSpecification;
  blueprint: AssetBlueprint;
  brain: ProjectBrainSlice;
  style: PixelStyle;
  seed: string;
  assetId?: string;
}

export interface GeneratorBackend {
  readonly id: string;
  generate(ctx: GenerationContext): PixelAssetDocument;
}

export interface GeneratorResult {
  document: PixelAssetDocument;
  backend: string;
  seed: string;
  warnings: string[];
}
