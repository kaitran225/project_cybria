import type { Layer, PaletteEntry, SparsePixel, SpriteDNA } from "@pixode/asset-core";
export type VariantKind = "color" | "equipment" | "faction" | "biome";
export interface VariantOverrides {
    paletteRemap?: Record<number, number>;
    paletteReplace?: PaletteEntry[];
    layerPatch?: Array<{
        layerId: string;
        pixels: SparsePixel[];
    }>;
    layerAdd?: Layer[];
    layerRemove?: string[];
    metadataTags?: string[];
    designPatch?: Partial<SpriteDNA>;
    assetId?: string;
}
export interface VariantDefinition {
    id: string;
    kind: VariantKind;
    baseAssetId: string;
    overrides: VariantOverrides;
}
export interface VariantSet {
    id: string;
    baseAssetId: string;
    variants: VariantDefinition[];
}
//# sourceMappingURL=types.d.ts.map