import type { AssetSpecification } from "./types.js";
export declare const assetSpecSchema: {
    readonly $schema: "http://json-schema.org/draft-07/schema#";
    readonly type: "object";
    readonly required: readonly ["id", "version", "category", "styleId", "blueprintId"];
    readonly properties: {
        readonly id: {
            readonly type: "string";
            readonly minLength: 1;
            readonly pattern: "^[a-z0-9_]+$";
        };
        readonly version: {
            readonly type: "string";
        };
        readonly category: {
            readonly type: "string";
            readonly enum: readonly ["character", "enemy", "npc", "item", "weapon", "environment", "tileset", "ui_icon"];
        };
        readonly theme: {
            readonly type: "string";
        };
        readonly species: {
            readonly type: "string";
        };
        readonly size: {
            readonly type: "string";
            readonly enum: readonly ["tiny", "small", "medium", "large"];
        };
        readonly styleId: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly blueprintId: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly canvas: {
            readonly type: "object";
            readonly properties: {
                readonly width: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 1024;
                };
                readonly height: {
                    readonly type: "integer";
                    readonly minimum: 1;
                    readonly maximum: 1024;
                };
            };
            readonly additionalProperties: false;
        };
        readonly animations: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly tags: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly constraints: {
            readonly type: "object";
        };
        readonly metadata: {
            readonly type: "object";
            readonly properties: {
                readonly author: {
                    readonly type: "string";
                };
                readonly notes: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
    };
    readonly additionalProperties: false;
};
export declare function validateSpecSchema(data: unknown): {
    valid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
};
export declare function isAssetSpecification(data: unknown): data is AssetSpecification;
//# sourceMappingURL=schema.d.ts.map