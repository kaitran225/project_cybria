export const SLIME_BLUEPRINT = {
    id: "slime",
    version: "1.0.0",
    name: "Slime",
    category: "enemy",
    canvas: { width: 16, height: 16 },
    layers: [
        { id: "body", role: "body", required: true, zOrder: 0 },
        { id: "eyes", role: "detail", required: false, zOrder: 1 },
        { id: "outline", role: "outline", required: true, zOrder: 2 },
    ],
    regions: [
        { id: "body", role: "torso", required: true, boundsHint: { x: 4, y: 5, w: 8, h: 8 } },
        { id: "eyes", role: "head", required: false, boundsHint: { x: 6, y: 7, w: 4, h: 2 } },
    ],
    animations: [{ id: "idle", required: true, minFrames: 1, maxFrames: 4, loop: true }],
    paletteSlots: [
        { role: "outline", required: true },
        { role: "fill", required: true },
        { role: "highlight", required: false },
        { role: "eye", required: false },
    ],
    symmetry: "horizontal",
    generationHints: { shape: "blob", anchorY: 12 },
};
export const HUMANOID_BLUEPRINT = {
    id: "humanoid",
    version: "1.0.0",
    name: "Humanoid",
    category: "character",
    canvas: { width: 16, height: 24 },
    layers: [
        { id: "body", role: "body", required: true, zOrder: 0 },
        { id: "equipment", role: "equipment", required: false, zOrder: 1 },
        { id: "outline", role: "outline", required: true, zOrder: 2 },
    ],
    regions: [
        { id: "head", role: "head", required: true, boundsHint: { x: 5, y: 2, w: 6, h: 6 } },
        { id: "torso", role: "torso", required: true, boundsHint: { x: 4, y: 8, w: 8, h: 8 } },
    ],
    animations: [
        { id: "idle", required: true, minFrames: 1, maxFrames: 4, loop: true },
        { id: "walk", required: false, minFrames: 2, maxFrames: 8, loop: true },
    ],
    paletteSlots: [
        { role: "outline", required: true },
        { role: "skin", required: true },
        { role: "clothing", required: false },
    ],
    symmetry: "vertical",
};
export const builtinBlueprints = {
    slime: SLIME_BLUEPRINT,
    humanoid: HUMANOID_BLUEPRINT,
};
//# sourceMappingURL=builtins.js.map