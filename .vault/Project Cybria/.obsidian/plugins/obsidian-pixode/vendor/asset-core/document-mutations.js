export function addLayer(doc, layerId, name, visible = true) {
    if (doc.layers.some((l) => l.id === layerId))
        return doc;
    return {
        ...doc,
        layers: [...doc.layers, { id: layerId, name, visible, pixels: [] }],
    };
}
export function setPixels(doc, layerId, pixels) {
    const layerIdx = doc.layers.findIndex((l) => l.id === layerId);
    if (layerIdx === -1)
        return doc;
    const pixelMap = new Map();
    for (const px of doc.layers[layerIdx].pixels) {
        pixelMap.set(`${px.x},${px.y}`, px);
    }
    for (const px of pixels) {
        pixelMap.set(`${px.x},${px.y}`, px);
    }
    const layers = [...doc.layers];
    layers[layerIdx] = { ...layers[layerIdx], pixels: [...pixelMap.values()] };
    return { ...doc, layers };
}
export function removePixels(doc, layerId, positions) {
    const layerIdx = doc.layers.findIndex((l) => l.id === layerId);
    if (layerIdx === -1)
        return doc;
    const removeSet = new Set(positions.map((p) => `${p.x},${p.y}`));
    const layers = [...doc.layers];
    layers[layerIdx] = {
        ...layers[layerIdx],
        pixels: layers[layerIdx].pixels.filter((px) => !removeSet.has(`${px.x},${px.y}`)),
    };
    return { ...doc, layers };
}
export function defineRegion(doc, region) {
    const regions = doc.regions.filter((r) => r.id !== region.id);
    regions.push(region);
    return { ...doc, regions };
}
export function createAnimation(doc, animation) {
    const states = (doc.animations?.states ?? []).filter((s) => s.id !== animation.id);
    states.push(animation);
    return {
        ...doc,
        animations: {
            ...doc.animations,
            states,
            transitions: doc.animations?.transitions ?? [],
        },
    };
}
export function addPaletteColor(doc, entry) {
    if (doc.palette.some((p) => p.id === entry.id))
        return doc;
    return { ...doc, palette: [...doc.palette, entry] };
}
export function updatePalette(doc, palette) {
    return { ...doc, palette };
}
export function updateAnimations(doc, animations) {
    return { ...doc, animations };
}
export const mutateAddLayer = addLayer;
export const mutateSetPixels = setPixels;
export const mutateRemovePixels = removePixels;
export const mutateUpdatePalette = updatePalette;
export const mutateUpdateAnimations = updateAnimations;
//# sourceMappingURL=document-mutations.js.map