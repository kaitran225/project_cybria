export function parseBlueprint(json) {
    const data = JSON.parse(json);
    if (!data.id || !data.layers || !data.canvas) {
        throw new Error("Invalid blueprint: missing required fields (id, layers, canvas)");
    }
    return {
        id: data.id,
        version: data.version ?? "1.0.0",
        name: data.name ?? data.id,
        category: data.category ?? "enemy",
        canvas: data.canvas,
        layers: data.layers,
        regions: data.regions ?? [],
        animations: data.animations ?? [],
        paletteSlots: data.paletteSlots ?? [],
        symmetry: data.symmetry ?? "none",
        generationHints: data.generationHints,
    };
}
//# sourceMappingURL=loader.js.map