import { fingerprint } from "./fingerprint.js";
function clusterKey(fp, by) {
    return by === "blueprint" ? fp.blueprintId ?? "unknown" : fp.category ?? "unknown";
}
export function findOutliers(fingerprints, clusterBy = "blueprint") {
    const groups = new Map();
    for (const fp of fingerprints) {
        const key = clusterKey(fp, clusterBy);
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(fp);
    }
    const outliers = [];
    for (const [key, fps] of groups) {
        if (fps.length < 2)
            continue;
        const paletteHashes = new Map();
        const silhouetteHashes = new Map();
        for (const fp of fps) {
            paletteHashes.set(fp.paletteHash, (paletteHashes.get(fp.paletteHash) ?? 0) + 1);
            silhouetteHashes.set(fp.silhouetteHash, (silhouetteHashes.get(fp.silhouetteHash) ?? 0) + 1);
        }
        const dominantPalette = [...paletteHashes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const dominantSilhouette = [...silhouetteHashes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const paletteOutliers = fps.filter((fp) => fp.paletteHash !== dominantPalette).map((fp) => fp.assetId);
        if (paletteOutliers.length > 0) {
            outliers.push({
                clusterKey: key,
                centroid: fps.find((fp) => fp.paletteHash === dominantPalette),
                outliers: paletteOutliers,
                driftType: "palette",
            });
        }
        const silOutliers = fps.filter((fp) => fp.silhouetteHash !== dominantSilhouette).map((fp) => fp.assetId);
        if (silOutliers.length > 0) {
            outliers.push({
                clusterKey: key,
                centroid: fps.find((fp) => fp.silhouetteHash === dominantSilhouette),
                outliers: silOutliers,
                driftType: "silhouette",
            });
        }
    }
    return outliers;
}
export function analyzeProject(assets) {
    const fingerprints = assets.map(fingerprint);
    const outlierGroups = findOutliers(fingerprints, "blueprint");
    const issues = [];
    for (const group of outlierGroups) {
        for (const assetId of group.outliers) {
            issues.push({
                assetId,
                type: group.driftType,
                message: `${group.driftType} drift detected in cluster "${group.clusterKey}"`,
            });
        }
    }
    const outlierCount = new Set(issues.map((i) => i.assetId)).size;
    const score = assets.length > 0
        ? Math.max(0, Math.round(100 - (outlierCount / assets.length) * 100))
        : 100;
    return {
        assetCount: assets.length,
        score,
        outliers: outlierGroups,
        issues,
    };
}
//# sourceMappingURL=analyze.js.map