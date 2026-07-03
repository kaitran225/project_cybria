export function parseStyle(json) {
    const data = JSON.parse(json);
    if (!data.id || typeof data.maxColors !== "number") {
        throw new Error("Invalid style: missing required fields (id, maxColors)");
    }
    return {
        id: data.id,
        version: data.version ?? "1.0.0",
        name: data.name ?? data.id,
        outline: data.outline ?? false,
        maxColors: data.maxColors,
        shadowStyle: data.shadowStyle ?? "none",
        palette: data.palette ?? [],
        allowedPaletteIds: data.allowedPaletteIds,
        canvasConstraints: data.canvasConstraints,
    };
}
//# sourceMappingURL=loader.js.map