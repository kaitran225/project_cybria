import { compileToRaster } from "@pixode/design";
function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}
export function fingerprint(doc) {
    const paletteHash = hashString([...doc.palette].sort((a, b) => a.id - b.id).map((p) => p.hex).join(","));
    const usedCounts = new Map();
    let totalPixels = 0;
    for (const layer of doc.layers) {
        for (const px of layer.pixels) {
            usedCounts.set(px.c, (usedCounts.get(px.c) ?? 0) + 1);
            totalPixels++;
        }
    }
    const paletteUsage = doc.palette.map((p) => totalPixels > 0 ? (usedCounts.get(p.id) ?? 0) / totalPixels : 0);
    let silhouetteHash = "empty";
    try {
        const compiled = compileToRaster(doc);
        const grid = compiled.frames[0]?.grid;
        if (grid) {
            const bits = grid.pixels.map((p) => (p.a > 0 ? "1" : "0")).join("");
            silhouetteHash = hashString(bits);
        }
    }
    catch {
        silhouetteHash = "error";
    }
    const animationSignature = doc.animations.states
        .map((s) => `${s.id}:${s.frames.length}`)
        .sort()
        .join("|");
    return {
        assetId: doc.id,
        paletteHash,
        paletteUsage,
        silhouetteHash,
        canvasSize: { w: doc.canvas.width, h: doc.canvas.height },
        animationSignature,
        blueprintId: doc.blueprintRef?.blueprintId,
        styleId: doc.styleRef?.styleId,
        category: doc.metadata.category,
    };
}
//# sourceMappingURL=fingerprint.js.map