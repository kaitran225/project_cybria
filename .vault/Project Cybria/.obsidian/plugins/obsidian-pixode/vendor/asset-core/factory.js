import { FORMAT_ID, FORMAT_VERSION } from "./types.js";
export function createSprite(opts) {
    return {
        format: FORMAT_ID,
        version: FORMAT_VERSION,
        id: opts.id,
        type: opts.type ?? "sprite",
        canvas: {
            width: opts.width ?? 16,
            height: opts.height ?? 16,
        },
        palette: [],
        layers: [
            {
                id: "base",
                name: "Base",
                visible: true,
                pixels: [],
            },
        ],
        regions: [],
        animations: { states: [], transitions: [] },
        design: {},
        metadata: { tags: [] },
    };
}
//# sourceMappingURL=factory.js.map