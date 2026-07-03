import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetFingerprint, ConsistencyReport, OutlierGroup } from "./types.js";
export declare function findOutliers(fingerprints: AssetFingerprint[], clusterBy?: "blueprint" | "category"): OutlierGroup[];
export declare function analyzeProject(assets: PixelAssetDocument[]): ConsistencyReport;
//# sourceMappingURL=analyze.d.ts.map