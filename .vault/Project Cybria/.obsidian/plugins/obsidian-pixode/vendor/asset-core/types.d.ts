export declare const FORMAT_ID: "pixel-asset";
export declare const FORMAT_VERSION: "0.3.0";
export interface SparsePixel {
    x: number;
    y: number;
    c: number;
    a?: number;
}
export interface PaletteEntry {
    id: number;
    hex: string;
    role?: string;
}
export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    opacity?: number;
    pixels: SparsePixel[];
}
export interface Region {
    id: string;
    name?: string;
    pixelRefs: Array<{
        layerId: string;
        x: number;
        y: number;
    }>;
}
export interface AnimationFrame {
    layerIds: string[];
    duration: number;
}
export interface Animation {
    id: string;
    name?: string;
    frames: AnimationFrame[];
    loop: boolean;
}
export interface AnimationTransition {
    from: string;
    to: string;
    condition?: string;
}
export interface AnimationGraph {
    states: Animation[];
    transitions: AnimationTransition[];
}
export interface SpriteDNA {
    species?: string;
    style?: string;
    outline?: boolean;
    paletteStyle?: string;
    symmetry?: boolean;
}
export interface Canvas {
    width: number;
    height: number;
}
export interface AssetMetadata {
    category?: string;
    tags: string[];
    author?: string;
    created?: string;
    modified?: string;
}
export interface GenerationRecord {
    prompt?: string;
    specId?: string;
    blueprintId?: string;
    backend?: string;
    model?: string;
    seed?: string;
    timestamp: string;
    version: number;
}
/** @deprecated Use GenerationRecord */
export type PromptRecord = GenerationRecord & {
    prompt: string;
};
export interface GenerationHistory {
    current: GenerationRecord;
    history: GenerationRecord[];
}
export type ReviewStatus = "draft" | "in_review" | "changes_requested" | "approved";
export interface ReviewComment {
    id: string;
    region?: string;
    author: string;
    message: string;
    timestamp: string;
    resolved: boolean;
}
export interface ReviewState {
    status: ReviewStatus;
    comments: ReviewComment[];
    approvedBy?: string;
    approvedAt?: string;
}
export interface StyleRef {
    styleId: string;
    version?: string;
}
export interface SpecRef {
    specId: string;
    version?: string;
}
export interface BlueprintRef {
    blueprintId: string;
    version?: string;
}
export interface VariantRef {
    baseAssetId: string;
    variantSetId: string;
    variantId: string;
}
export interface PixelAssetDocument {
    format: typeof FORMAT_ID;
    version: string;
    id: string;
    type: "sprite" | "tileset" | "icon";
    canvas: Canvas;
    palette: PaletteEntry[];
    layers: Layer[];
    regions: Region[];
    animations: AnimationGraph;
    design: SpriteDNA;
    metadata: AssetMetadata;
    generation?: GenerationHistory;
    review?: ReviewState;
    styleRef?: StyleRef;
    specRef?: SpecRef;
    blueprintRef?: BlueprintRef;
    variantOf?: VariantRef;
}
export interface ValidationIssue {
    code: string;
    path: string;
    message: string;
}
export interface ValidationResult {
    ok: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}
export interface RasterPixel {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface RasterGrid {
    width: number;
    height: number;
    /** Row-major RGBA data, length = width * height */
    pixels: RasterPixel[];
}
export interface CompiledFrame {
    index: number;
    duration: number;
    grid: RasterGrid;
}
export interface CompileResult {
    id: string;
    canvas: {
        width: number;
        height: number;
    };
    frames: CompiledFrame[];
}
//# sourceMappingURL=types.d.ts.map