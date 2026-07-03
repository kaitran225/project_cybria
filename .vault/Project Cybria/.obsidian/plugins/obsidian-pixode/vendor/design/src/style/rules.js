export function maxColorsRule(style) {
    return (ctx) => {
        if (ctx.doc.palette.length > style.maxColors) {
            ctx.errors.push({
                code: "STYLE_MAX_COLORS",
                path: "/palette",
                message: `Palette has ${ctx.doc.palette.length} colors, style "${style.id}" allows max ${style.maxColors}`,
            });
        }
    };
}
export function paletteComplianceRule(style) {
    return (ctx) => {
        const allowed = style.allowedPaletteIds
            ? new Set(style.allowedPaletteIds)
            : null;
        const styleHexes = new Set(style.palette.map((p) => p.hex.toLowerCase()));
        for (const [pi, entry] of ctx.doc.palette.entries()) {
            if (allowed && !allowed.has(entry.id)) {
                ctx.errors.push({
                    code: "STYLE_PALETTE_ID_NOT_ALLOWED",
                    path: `/palette/${pi}`,
                    message: `Palette id ${entry.id} not in style's allowed list`,
                });
                continue;
            }
            if (styleHexes.size > 0 && !styleHexes.has(entry.hex.toLowerCase())) {
                ctx.warnings.push({
                    code: "STYLE_PALETTE_COLOR_MISMATCH",
                    path: `/palette/${pi}`,
                    message: `Color ${entry.hex} not found in style "${style.id}" palette`,
                });
            }
        }
    };
}
export function outlineRule(style) {
    return (ctx) => {
        if (!style.outline)
            return;
        for (const [li, layer] of ctx.doc.layers.entries()) {
            if (layer.pixels.length === 0)
                continue;
            const pixelSet = new Set(layer.pixels.map((p) => `${p.x},${p.y}`));
            const outlineRoleIds = new Set(ctx.doc.palette
                .filter((p) => p.role === "outline")
                .map((p) => p.id));
            if (outlineRoleIds.size === 0) {
                ctx.warnings.push({
                    code: "STYLE_NO_OUTLINE_COLOR",
                    path: "/palette",
                    message: `Style requires outline but no palette entry has role "outline"`,
                });
                return;
            }
            const { width, height } = ctx.doc.canvas;
            for (const px of layer.pixels) {
                if (outlineRoleIds.has(px.c))
                    continue;
                const neighbors = [
                    [px.x - 1, px.y],
                    [px.x + 1, px.y],
                    [px.x, px.y - 1],
                    [px.x, px.y + 1],
                ];
                for (const [nx, ny] of neighbors) {
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height)
                        continue;
                    if (!pixelSet.has(`${nx},${ny}`)) {
                        const hasOutlineNeighbor = layer.pixels.some((op) => op.x === px.x && op.y === px.y && outlineRoleIds.has(op.c));
                        if (!hasOutlineNeighbor) {
                            ctx.warnings.push({
                                code: "STYLE_MISSING_OUTLINE",
                                path: `/layers/${li}`,
                                message: `Pixel (${px.x},${px.y}) is on edge but has no adjacent outline pixel`,
                            });
                            return;
                        }
                    }
                }
            }
        }
    };
}
export function canvasSizeRule(style) {
    return (ctx) => {
        const c = style.canvasConstraints;
        if (!c)
            return;
        const { width, height } = ctx.doc.canvas;
        if (width < c.minWidth || width > c.maxWidth) {
            ctx.errors.push({
                code: "STYLE_CANVAS_WIDTH",
                path: "/canvas/width",
                message: `Canvas width ${width} outside style range [${c.minWidth}, ${c.maxWidth}]`,
            });
        }
        if (height < c.minHeight || height > c.maxHeight) {
            ctx.errors.push({
                code: "STYLE_CANVAS_HEIGHT",
                path: "/canvas/height",
                message: `Canvas height ${height} outside style range [${c.minHeight}, ${c.maxHeight}]`,
            });
        }
    };
}
export function createStyleRules(style) {
    return [
        maxColorsRule(style),
        paletteComplianceRule(style),
        outlineRule(style),
        canvasSizeRule(style),
    ];
}
//# sourceMappingURL=rules.js.map