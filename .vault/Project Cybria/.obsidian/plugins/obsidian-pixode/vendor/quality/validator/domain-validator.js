const checkPixelBounds = ({ doc, errors }) => {
    const { width, height } = doc.canvas;
    for (const [li, layer] of doc.layers.entries()) {
        for (const [pi, px] of layer.pixels.entries()) {
            if (px.x < 0 || px.x >= width || px.y < 0 || px.y >= height) {
                errors.push({
                    code: "PIXEL_OUT_OF_BOUNDS",
                    path: `/layers/${li}/pixels/${pi}`,
                    message: `Pixel (${px.x},${px.y}) outside canvas ${width}x${height}`,
                });
            }
        }
    }
};
const checkPaletteRefs = ({ doc, errors }) => {
    const paletteIds = new Set(doc.palette.map((p) => p.id));
    for (const [li, layer] of doc.layers.entries()) {
        for (const [pi, px] of layer.pixels.entries()) {
            if (!paletteIds.has(px.c)) {
                errors.push({
                    code: "INVALID_PALETTE_REF",
                    path: `/layers/${li}/pixels/${pi}`,
                    message: `Pixel references palette id ${px.c} which does not exist`,
                });
            }
        }
    }
};
const checkDuplicatePixels = ({ doc, warnings }) => {
    for (const [li, layer] of doc.layers.entries()) {
        const seen = new Set();
        for (const [pi, px] of layer.pixels.entries()) {
            const key = `${px.x},${px.y}`;
            if (seen.has(key)) {
                warnings.push({
                    code: "DUPLICATE_PIXEL",
                    path: `/layers/${li}/pixels/${pi}`,
                    message: `Duplicate pixel at (${px.x},${px.y}) in layer "${layer.id}"`,
                });
            }
            seen.add(key);
        }
    }
};
const checkDuplicateLayerIds = ({ doc, errors }) => {
    const seen = new Set();
    for (const [li, layer] of doc.layers.entries()) {
        if (seen.has(layer.id)) {
            errors.push({
                code: "DUPLICATE_LAYER_ID",
                path: `/layers/${li}`,
                message: `Duplicate layer id "${layer.id}"`,
            });
        }
        seen.add(layer.id);
    }
};
const checkDuplicatePaletteIds = ({ doc, errors }) => {
    const seen = new Set();
    for (const [pi, entry] of doc.palette.entries()) {
        if (seen.has(entry.id)) {
            errors.push({
                code: "DUPLICATE_PALETTE_ID",
                path: `/palette/${pi}`,
                message: `Duplicate palette id ${entry.id}`,
            });
        }
        seen.add(entry.id);
    }
};
const checkAnimationLayerRefs = ({ doc, errors }) => {
    if (!doc.animations?.states)
        return;
    const layerIds = new Set(doc.layers.map((l) => l.id));
    for (const [si, state] of doc.animations.states.entries()) {
        for (const [fi, frame] of state.frames.entries()) {
            for (const layerId of frame.layerIds) {
                if (!layerIds.has(layerId)) {
                    errors.push({
                        code: "INVALID_ANIMATION_LAYER_REF",
                        path: `/animations/states/${si}/frames/${fi}`,
                        message: `Animation frame references nonexistent layer "${layerId}"`,
                    });
                }
            }
        }
    }
};
const checkAnimationTransitionRefs = ({ doc, errors }) => {
    if (!doc.animations?.transitions)
        return;
    const stateIds = new Set((doc.animations.states ?? []).map((s) => s.id));
    for (const [ti, tr] of doc.animations.transitions.entries()) {
        if (!stateIds.has(tr.from)) {
            errors.push({
                code: "INVALID_TRANSITION_REF",
                path: `/animations/transitions/${ti}`,
                message: `Transition references nonexistent state "${tr.from}"`,
            });
        }
        if (!stateIds.has(tr.to)) {
            errors.push({
                code: "INVALID_TRANSITION_REF",
                path: `/animations/transitions/${ti}`,
                message: `Transition references nonexistent state "${tr.to}"`,
            });
        }
    }
};
const checkRegionRefs = ({ doc, errors }) => {
    if (!doc.regions)
        return;
    const layerIds = new Set(doc.layers.map((l) => l.id));
    for (const [ri, region] of doc.regions.entries()) {
        for (const [pi, ref] of region.pixelRefs.entries()) {
            if (!layerIds.has(ref.layerId)) {
                errors.push({
                    code: "INVALID_REGION_LAYER_REF",
                    path: `/regions/${ri}/pixelRefs/${pi}`,
                    message: `Region references nonexistent layer "${ref.layerId}"`,
                });
            }
        }
    }
};
const checkMaxColors = ({ doc, warnings }) => {
    if (doc.palette.length > 256) {
        warnings.push({
            code: "EXCESSIVE_PALETTE",
            path: "/palette",
            message: `Palette has ${doc.palette.length} entries (>256)`,
        });
    }
};
const builtinRules = [
    checkPixelBounds,
    checkPaletteRefs,
    checkDuplicatePixels,
    checkDuplicateLayerIds,
    checkDuplicatePaletteIds,
    checkAnimationLayerRefs,
    checkAnimationTransitionRefs,
    checkRegionRefs,
    checkMaxColors,
];
export function runDomainValidation(doc, extraRules = []) {
    const ctx = { doc, errors: [], warnings: [] };
    for (const rule of [...builtinRules, ...extraRules]) {
        rule(ctx);
    }
    return {
        ok: ctx.errors.length === 0,
        errors: ctx.errors,
        warnings: ctx.warnings,
    };
}
//# sourceMappingURL=domain-validator.js.map