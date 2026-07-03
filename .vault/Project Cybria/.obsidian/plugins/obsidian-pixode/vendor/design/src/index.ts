export type { AssetSpecification, AssetCategory, AssetSize } from "./specification/types.js";
export { parseSpec } from "./specification/loader.js";
export { validateSpec, type SpecValidationResult } from "./specification/validate-spec.js";
export { validateSpecSchema, assetSpecSchema } from "./specification/schema.js";

export type {
  AssetBlueprint,
  BlueprintLayer,
  BlueprintRegion,
  BlueprintAnimation,
  BlueprintLayerRole,
} from "./blueprints/types.js";
export { parseBlueprint } from "./blueprints/loader.js";
export {
  validateAgainstBlueprint,
  type BlueprintValidationResult,
} from "./blueprints/validate-blueprint.js";
export { SLIME_BLUEPRINT, HUMANOID_BLUEPRINT, builtinBlueprints } from "./blueprints/builtins.js";

export type { PixelStyle, CanvasConstraints } from "./style/types.js";
export {
  createStyleRules,
  maxColorsRule,
  paletteComplianceRule,
  outlineRule,
  canvasSizeRule,
} from "./style/rules.js";
export type { DomainRule, DomainRuleContext } from "@pixode/asset-core";
export { parseStyle } from "./style/loader.js";

export type {
  VariantKind,
  VariantDefinition,
  VariantSet,
  VariantOverrides,
} from "./variants/types.js";
export { applyVariant, generateVariantSet, parseVariantSet } from "./variants/apply-variant.js";

export {
  compileToRaster,
  type RasterPixel,
  type RasterGrid,
  type CompiledFrame,
  type CompileResult,
} from "./compiler/raster.js";
