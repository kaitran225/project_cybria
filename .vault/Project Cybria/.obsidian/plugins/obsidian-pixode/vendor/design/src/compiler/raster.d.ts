import type { PixelAssetDocument, RasterPixel, RasterGrid, CompiledFrame, CompileResult } from "@pixode/asset-core";
export type { RasterPixel, RasterGrid, CompiledFrame, CompileResult };
/**
 * Compiles a PixelAssetDocument into raster grids.
 * If animations exist, produces one frame per animation frame.
 * Otherwise produces a single frame compositing all visible layers.
 */
export declare function compileToRaster(doc: PixelAssetDocument): CompileResult;
//# sourceMappingURL=raster.d.ts.map