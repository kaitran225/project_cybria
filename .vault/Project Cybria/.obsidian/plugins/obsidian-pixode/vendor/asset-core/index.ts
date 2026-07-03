export {
  FORMAT_ID,
  FORMAT_VERSION,
  type SparsePixel,
  type PaletteEntry,
  type Layer,
  type Region,
  type AnimationFrame,
  type Animation,
  type AnimationTransition,
  type AnimationGraph,
  type SpriteDNA,
  type Canvas,
  type AssetMetadata,
  type GenerationRecord,
  type PromptRecord,
  type GenerationHistory,
  type ReviewComment,
  type ReviewState,
  type ReviewStatus,
  type StyleRef,
  type SpecRef,
  type BlueprintRef,
  type VariantRef,
  type PixelAssetDocument,
  type ValidationIssue,
  type ValidationResult,
  type RasterPixel,
  type RasterGrid,
  type CompiledFrame,
  type CompileResult,
} from "./types.js";

export type { DomainRule, DomainRuleContext } from "./domain-rule.js";

export { validateSchema, pixelAssetSchema, getSchemaJSON } from "./schema.js";
export { serialize, deserialize } from "./serializer.js";
export { createSprite, type CreateSpriteOptions } from "./factory.js";
export {
  addLayer,
  setPixels,
  removePixels,
  defineRegion,
  createAnimation,
  addPaletteColor,
  updatePalette,
  updateAnimations,
  mutateAddLayer,
  mutateSetPixels,
  mutateRemovePixels,
  mutateUpdatePalette,
  mutateUpdateAnimations,
} from "./document-mutations.js";
