import type { PixelAssetDocument } from "@pixode/asset-core";
import type { VariantDefinition, VariantSet } from "./types.js";
export declare function applyVariant(base: PixelAssetDocument, def: VariantDefinition, variantSetId?: string): PixelAssetDocument;
export declare function generateVariantSet(base: PixelAssetDocument, set: VariantSet): PixelAssetDocument[];
export declare function parseVariantSet(json: string): VariantSet;
//# sourceMappingURL=apply-variant.d.ts.map