function comparePixels(a, b) {
    if (a.y !== b.y)
        return a.y - b.y;
    if (a.x !== b.x)
        return a.x - b.x;
    return a.c - b.c;
}
/**
 * Produces a deterministic, Git-friendly JSON string from a PixelAssetDocument.
 * Sorts pixels by y,x,c and uses a stable key order throughout.
 */
export function serialize(doc) {
    const normalized = {
        format: doc.format,
        version: doc.version,
        id: doc.id,
        type: doc.type,
        canvas: { width: doc.canvas.width, height: doc.canvas.height },
        palette: [...doc.palette].sort((a, b) => a.id - b.id),
        layers: doc.layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            ...(layer.opacity !== undefined ? { opacity: layer.opacity } : {}),
            pixels: [...layer.pixels].sort(comparePixels),
        })),
        regions: [...doc.regions].sort((a, b) => a.id.localeCompare(b.id)),
        animations: {
            states: [...doc.animations.states].sort((a, b) => a.id.localeCompare(b.id)),
            transitions: [...doc.animations.transitions],
        },
        design: doc.design,
        metadata: {
            ...doc.metadata,
            tags: [...(doc.metadata.tags ?? [])].sort(),
        },
    };
    if (doc.generation)
        normalized.generation = doc.generation;
    if (doc.review) {
        normalized.review = {
            ...doc.review,
            comments: [...doc.review.comments].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
        };
    }
    if (doc.styleRef)
        normalized.styleRef = doc.styleRef;
    if (doc.specRef)
        normalized.specRef = doc.specRef;
    if (doc.blueprintRef)
        normalized.blueprintRef = doc.blueprintRef;
    if (doc.variantOf)
        normalized.variantOf = doc.variantOf;
    return JSON.stringify(normalized, null, 2) + "\n";
}
/** Parse a JSON string into an unvalidated document shape. */
export function deserialize(json) {
    return JSON.parse(json);
}
//# sourceMappingURL=serializer.js.map