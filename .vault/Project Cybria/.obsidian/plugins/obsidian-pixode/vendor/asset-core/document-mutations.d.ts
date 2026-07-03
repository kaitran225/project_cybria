import type { Animation, AnimationGraph, PaletteEntry, PixelAssetDocument, Region, SparsePixel } from "./types.js";
export declare function addLayer(doc: PixelAssetDocument, layerId: string, name: string, visible?: boolean): PixelAssetDocument;
export declare function setPixels(doc: PixelAssetDocument, layerId: string, pixels: SparsePixel[]): PixelAssetDocument;
export declare function removePixels(doc: PixelAssetDocument, layerId: string, positions: Array<{
    x: number;
    y: number;
}>): PixelAssetDocument;
export declare function defineRegion(doc: PixelAssetDocument, region: Region): PixelAssetDocument;
export declare function createAnimation(doc: PixelAssetDocument, animation: Animation): PixelAssetDocument;
export declare function addPaletteColor(doc: PixelAssetDocument, entry: PaletteEntry): PixelAssetDocument;
export declare function updatePalette(doc: PixelAssetDocument, palette: PaletteEntry[]): PixelAssetDocument;
export declare function updateAnimations(doc: PixelAssetDocument, animations: AnimationGraph): PixelAssetDocument;
export declare const mutateAddLayer: typeof addLayer;
export declare const mutateSetPixels: typeof setPixels;
export declare const mutateRemovePixels: typeof removePixels;
export declare const mutateUpdatePalette: typeof updatePalette;
export declare const mutateUpdateAnimations: typeof updateAnimations;
//# sourceMappingURL=document-mutations.d.ts.map