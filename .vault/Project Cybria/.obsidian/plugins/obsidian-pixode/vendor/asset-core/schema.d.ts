export declare const pixelAssetSchema: {
    readonly $schema: "http://json-schema.org/draft-07/schema#";
    readonly type: "object";
    readonly required: readonly ["format", "version", "id", "type", "canvas", "palette", "layers"];
    readonly properties: {
        readonly format: {
            readonly type: "string";
            readonly const: "pixel-asset";
        };
        readonly version: {
            readonly type: "string";
            readonly pattern: "^\\d+\\.\\d+\\.\\d+$";
        };
        readonly id: {
            readonly type: "string";
            readonly minLength: 1;
            readonly pattern: "^[a-z0-9_]+$";
        };
        readonly type: {
            readonly type: "string";
            readonly enum: readonly ["sprite", "tileset", "icon"];
        };
        readonly canvas: {
            readonly type: "object";
            readonly required: readonly ["width", "height"];
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
        readonly palette: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly required: readonly ["id", "hex"];
                readonly properties: {
                    readonly id: {
                        readonly type: "integer";
                        readonly minimum: 0;
                    };
                    readonly hex: {
                        readonly type: "string";
                        readonly pattern: "^#[0-9a-fA-F]{6}$";
                    };
                    readonly role: {
                        readonly type: "string";
                    };
                };
                readonly additionalProperties: false;
            };
        };
        readonly layers: {
            readonly type: "array";
            readonly minItems: 1;
            readonly items: {
                readonly type: "object";
                readonly required: readonly ["id", "name", "visible", "pixels"];
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly minLength: 1;
                    };
                    readonly name: {
                        readonly type: "string";
                    };
                    readonly visible: {
                        readonly type: "boolean";
                    };
                    readonly opacity: {
                        readonly type: "number";
                        readonly minimum: 0;
                        readonly maximum: 1;
                    };
                    readonly pixels: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly required: readonly ["x", "y", "c"];
                            readonly properties: {
                                readonly x: {
                                    readonly type: "integer";
                                    readonly minimum: 0;
                                };
                                readonly y: {
                                    readonly type: "integer";
                                    readonly minimum: 0;
                                };
                                readonly c: {
                                    readonly type: "integer";
                                    readonly minimum: 0;
                                };
                                readonly a: {
                                    readonly type: "number";
                                    readonly minimum: 0;
                                    readonly maximum: 1;
                                };
                            };
                            readonly additionalProperties: false;
                        };
                    };
                };
                readonly additionalProperties: false;
            };
        };
        readonly regions: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly required: readonly ["id", "pixelRefs"];
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly minLength: 1;
                    };
                    readonly name: {
                        readonly type: "string";
                    };
                    readonly pixelRefs: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly required: readonly ["layerId", "x", "y"];
                            readonly properties: {
                                readonly layerId: {
                                    readonly type: "string";
                                };
                                readonly x: {
                                    readonly type: "integer";
                                    readonly minimum: 0;
                                };
                                readonly y: {
                                    readonly type: "integer";
                                    readonly minimum: 0;
                                };
                            };
                            readonly additionalProperties: false;
                        };
                    };
                };
                readonly additionalProperties: false;
            };
        };
        readonly animations: {
            readonly type: "object";
            readonly properties: {
                readonly states: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["id", "frames", "loop"];
                        readonly properties: {
                            readonly id: {
                                readonly type: "string";
                                readonly minLength: 1;
                            };
                            readonly name: {
                                readonly type: "string";
                            };
                            readonly loop: {
                                readonly type: "boolean";
                            };
                            readonly frames: {
                                readonly type: "array";
                                readonly items: {
                                    readonly type: "object";
                                    readonly required: readonly ["layerIds", "duration"];
                                    readonly properties: {
                                        readonly layerIds: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "string";
                                            };
                                        };
                                        readonly duration: {
                                            readonly type: "number";
                                            readonly minimum: 0;
                                        };
                                    };
                                    readonly additionalProperties: false;
                                };
                            };
                        };
                        readonly additionalProperties: false;
                    };
                };
                readonly transitions: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["from", "to"];
                        readonly properties: {
                            readonly from: {
                                readonly type: "string";
                            };
                            readonly to: {
                                readonly type: "string";
                            };
                            readonly condition: {
                                readonly type: "string";
                            };
                        };
                        readonly additionalProperties: false;
                    };
                };
            };
            readonly additionalProperties: false;
        };
        readonly design: {
            readonly type: "object";
            readonly properties: {
                readonly species: {
                    readonly type: "string";
                };
                readonly style: {
                    readonly type: "string";
                };
                readonly outline: {
                    readonly type: "boolean";
                };
                readonly paletteStyle: {
                    readonly type: "string";
                };
                readonly symmetry: {
                    readonly type: "boolean";
                };
            };
            readonly additionalProperties: false;
        };
        readonly metadata: {
            readonly type: "object";
            readonly properties: {
                readonly category: {
                    readonly type: "string";
                };
                readonly tags: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
                readonly author: {
                    readonly type: "string";
                };
                readonly created: {
                    readonly type: "string";
                };
                readonly modified: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
        readonly generation: {
            readonly type: "object";
            readonly required: readonly ["current", "history"];
            readonly properties: {
                readonly current: {
                    readonly type: "object";
                    readonly required: readonly ["timestamp", "version"];
                    readonly properties: {
                        readonly prompt: {
                            readonly type: "string";
                        };
                        readonly specId: {
                            readonly type: "string";
                        };
                        readonly blueprintId: {
                            readonly type: "string";
                        };
                        readonly backend: {
                            readonly type: "string";
                        };
                        readonly model: {
                            readonly type: "string";
                        };
                        readonly seed: {
                            readonly type: "string";
                        };
                        readonly timestamp: {
                            readonly type: "string";
                        };
                        readonly version: {
                            readonly type: "integer";
                            readonly minimum: 1;
                        };
                    };
                    readonly additionalProperties: false;
                };
                readonly history: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["timestamp", "version"];
                        readonly properties: {
                            readonly prompt: {
                                readonly type: "string";
                            };
                            readonly specId: {
                                readonly type: "string";
                            };
                            readonly blueprintId: {
                                readonly type: "string";
                            };
                            readonly backend: {
                                readonly type: "string";
                            };
                            readonly model: {
                                readonly type: "string";
                            };
                            readonly seed: {
                                readonly type: "string";
                            };
                            readonly timestamp: {
                                readonly type: "string";
                            };
                            readonly version: {
                                readonly type: "integer";
                                readonly minimum: 1;
                            };
                        };
                        readonly additionalProperties: false;
                    };
                };
            };
            readonly additionalProperties: false;
        };
        readonly review: {
            readonly type: "object";
            readonly required: readonly ["status", "comments"];
            readonly properties: {
                readonly status: {
                    readonly type: "string";
                    readonly enum: readonly ["draft", "in_review", "changes_requested", "approved"];
                };
                readonly comments: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["id", "author", "message", "timestamp", "resolved"];
                        readonly properties: {
                            readonly id: {
                                readonly type: "string";
                                readonly minLength: 1;
                            };
                            readonly region: {
                                readonly type: "string";
                            };
                            readonly author: {
                                readonly type: "string";
                            };
                            readonly message: {
                                readonly type: "string";
                            };
                            readonly timestamp: {
                                readonly type: "string";
                            };
                            readonly resolved: {
                                readonly type: "boolean";
                            };
                        };
                        readonly additionalProperties: false;
                    };
                };
                readonly approvedBy: {
                    readonly type: "string";
                };
                readonly approvedAt: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
        readonly styleRef: {
            readonly type: "object";
            readonly required: readonly ["styleId"];
            readonly properties: {
                readonly styleId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly version: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
        readonly specRef: {
            readonly type: "object";
            readonly required: readonly ["specId"];
            readonly properties: {
                readonly specId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly version: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
        readonly blueprintRef: {
            readonly type: "object";
            readonly required: readonly ["blueprintId"];
            readonly properties: {
                readonly blueprintId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly version: {
                    readonly type: "string";
                };
            };
            readonly additionalProperties: false;
        };
        readonly variantOf: {
            readonly type: "object";
            readonly required: readonly ["baseAssetId", "variantSetId", "variantId"];
            readonly properties: {
                readonly baseAssetId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly variantSetId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
                readonly variantId: {
                    readonly type: "string";
                    readonly minLength: 1;
                };
            };
            readonly additionalProperties: false;
        };
    };
    readonly additionalProperties: false;
};
export declare function validateSchema(data: unknown): {
    valid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
};
export declare function getSchemaJSON(): string;
//# sourceMappingURL=schema.d.ts.map