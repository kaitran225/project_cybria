import { type PixelAssetDocument } from "./types.js";
export interface CreateSpriteOptions {
    id: string;
    width?: number;
    height?: number;
    type?: PixelAssetDocument["type"];
}
export declare function createSprite(opts: CreateSpriteOptions): PixelAssetDocument;
//# sourceMappingURL=factory.d.ts.map