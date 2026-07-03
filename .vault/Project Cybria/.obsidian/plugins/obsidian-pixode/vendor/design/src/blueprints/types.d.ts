import type { AssetCategory } from "../specification/types.js";
export type BlueprintLayerRole = "body" | "outline" | "detail" | "equipment" | "fx";
export interface BlueprintLayer {
    id: string;
    role: BlueprintLayerRole;
    required: boolean;
    zOrder: number;
}
export interface BlueprintRegion {
    id: string;
    role: string;
    required: boolean;
    boundsHint?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}
export interface BlueprintAnimation {
    id: string;
    required: boolean;
    minFrames: number;
    maxFrames: number;
    loop: boolean;
}
export interface AssetBlueprint {
    id: string;
    version: string;
    name: string;
    category: AssetCategory;
    canvas: {
        width: number;
        height: number;
    };
    layers: BlueprintLayer[];
    regions: BlueprintRegion[];
    animations: BlueprintAnimation[];
    paletteSlots: Array<{
        role: string;
        required: boolean;
    }>;
    symmetry?: "none" | "horizontal" | "vertical";
    generationHints?: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map