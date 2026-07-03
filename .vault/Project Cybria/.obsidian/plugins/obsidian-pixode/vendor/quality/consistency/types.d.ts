export interface AssetFingerprint {
    assetId: string;
    paletteHash: string;
    paletteUsage: number[];
    silhouetteHash: string;
    canvasSize: {
        w: number;
        h: number;
    };
    animationSignature: string;
    blueprintId?: string;
    styleId?: string;
    category?: string;
}
export interface OutlierGroup {
    clusterKey: string;
    centroid: AssetFingerprint;
    outliers: string[];
    driftType: "palette" | "silhouette" | "animation" | "style";
}
export interface ConsistencyReport {
    assetCount: number;
    score: number;
    outliers: OutlierGroup[];
    issues: Array<{
        assetId: string;
        type: string;
        message: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map