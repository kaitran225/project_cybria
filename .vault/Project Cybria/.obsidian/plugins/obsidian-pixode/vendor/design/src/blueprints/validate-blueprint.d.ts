import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetBlueprint } from "./types.js";
export interface BlueprintValidationResult {
    ok: boolean;
    errors: Array<{
        code: string;
        path: string;
        message: string;
    }>;
}
export declare function validateAgainstBlueprint(doc: PixelAssetDocument, blueprint: AssetBlueprint): BlueprintValidationResult;
//# sourceMappingURL=validate-blueprint.d.ts.map