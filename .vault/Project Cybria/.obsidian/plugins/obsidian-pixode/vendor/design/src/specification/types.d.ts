export type AssetCategory = "character" | "enemy" | "npc" | "item" | "weapon" | "environment" | "tileset" | "ui_icon";
export type AssetSize = "tiny" | "small" | "medium" | "large";
export interface AssetSpecification {
    id: string;
    version: string;
    category: AssetCategory;
    theme?: string;
    species?: string;
    size?: AssetSize;
    styleId: string;
    blueprintId: string;
    canvas?: {
        width: number;
        height: number;
    };
    animations?: string[];
    tags?: string[];
    constraints?: Record<string, unknown>;
    metadata?: {
        author?: string;
        notes?: string;
    };
}
//# sourceMappingURL=types.d.ts.map