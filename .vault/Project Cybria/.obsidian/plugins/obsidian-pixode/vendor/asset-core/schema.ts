import Ajv from "ajv";
import type { PixelAssetDocument } from "./types.js";

export const pixelAssetSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: [
    "format",
    "version",
    "id",
    "type",
    "canvas",
    "palette",
    "layers",
  ],
  properties: {
    format: { type: "string", const: "pixel-asset" },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
    id: { type: "string", minLength: 1, pattern: "^[a-z0-9_]+$" },
    type: { type: "string", enum: ["sprite", "tileset", "icon"] },
    canvas: {
      type: "object",
      required: ["width", "height"],
      properties: {
        width: { type: "integer", minimum: 1, maximum: 1024 },
        height: { type: "integer", minimum: 1, maximum: 1024 },
      },
      additionalProperties: false,
    },
    palette: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "hex"],
        properties: {
          id: { type: "integer", minimum: 0 },
          hex: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          role: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    layers: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "name", "visible", "pixels"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string" },
          visible: { type: "boolean" },
          opacity: { type: "number", minimum: 0, maximum: 1 },
          pixels: {
            type: "array",
            items: {
              type: "object",
              required: ["x", "y", "c"],
              properties: {
                x: { type: "integer", minimum: 0 },
                y: { type: "integer", minimum: 0 },
                c: { type: "integer", minimum: 0 },
                a: { type: "number", minimum: 0, maximum: 1 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    regions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "pixelRefs"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string" },
          pixelRefs: {
            type: "array",
            items: {
              type: "object",
              required: ["layerId", "x", "y"],
              properties: {
                layerId: { type: "string" },
                x: { type: "integer", minimum: 0 },
                y: { type: "integer", minimum: 0 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    animations: {
      type: "object",
      properties: {
        states: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "frames", "loop"],
            properties: {
              id: { type: "string", minLength: 1 },
              name: { type: "string" },
              loop: { type: "boolean" },
              frames: {
                type: "array",
                items: {
                  type: "object",
                  required: ["layerIds", "duration"],
                  properties: {
                    layerIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                    duration: { type: "number", minimum: 0 },
                  },
                  additionalProperties: false,
                },
              },
            },
            additionalProperties: false,
          },
        },
        transitions: {
          type: "array",
          items: {
            type: "object",
            required: ["from", "to"],
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              condition: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    design: {
      type: "object",
      properties: {
        species: { type: "string" },
        style: { type: "string" },
        outline: { type: "boolean" },
        paletteStyle: { type: "string" },
        symmetry: { type: "boolean" },
      },
      additionalProperties: false,
    },
    metadata: {
      type: "object",
      properties: {
        category: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        author: { type: "string" },
        created: { type: "string" },
        modified: { type: "string" },
      },
      additionalProperties: false,
    },
    generation: {
      type: "object",
      required: ["current", "history"],
      properties: {
        current: {
          type: "object",
          required: ["timestamp", "version"],
          properties: {
            prompt: { type: "string" },
            specId: { type: "string" },
            blueprintId: { type: "string" },
            backend: { type: "string" },
            model: { type: "string" },
            seed: { type: "string" },
            timestamp: { type: "string" },
            version: { type: "integer", minimum: 1 },
          },
          additionalProperties: false,
        },
        history: {
          type: "array",
          items: {
            type: "object",
            required: ["timestamp", "version"],
            properties: {
              prompt: { type: "string" },
              specId: { type: "string" },
              blueprintId: { type: "string" },
              backend: { type: "string" },
              model: { type: "string" },
              seed: { type: "string" },
              timestamp: { type: "string" },
              version: { type: "integer", minimum: 1 },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    review: {
      type: "object",
      required: ["status", "comments"],
      properties: {
        status: {
          type: "string",
          enum: ["draft", "in_review", "changes_requested", "approved"],
        },
        comments: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "author", "message", "timestamp", "resolved"],
            properties: {
              id: { type: "string", minLength: 1 },
              region: { type: "string" },
              author: { type: "string" },
              message: { type: "string" },
              timestamp: { type: "string" },
              resolved: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        approvedBy: { type: "string" },
        approvedAt: { type: "string" },
      },
      additionalProperties: false,
    },
    styleRef: {
      type: "object",
      required: ["styleId"],
      properties: {
        styleId: { type: "string", minLength: 1 },
        version: { type: "string" },
      },
      additionalProperties: false,
    },
    specRef: {
      type: "object",
      required: ["specId"],
      properties: {
        specId: { type: "string", minLength: 1 },
        version: { type: "string" },
      },
      additionalProperties: false,
    },
    blueprintRef: {
      type: "object",
      required: ["blueprintId"],
      properties: {
        blueprintId: { type: "string", minLength: 1 },
        version: { type: "string" },
      },
      additionalProperties: false,
    },
    variantOf: {
      type: "object",
      required: ["baseAssetId", "variantSetId", "variantId"],
      properties: {
        baseAssetId: { type: "string", minLength: 1 },
        variantSetId: { type: "string", minLength: 1 },
        variantId: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const ajv = new Ajv.default({ allErrors: true });
const validateFn = ajv.compile(pixelAssetSchema);

export function validateSchema(data: unknown): {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
} {
  const valid = validateFn(data);
  if (valid) return { valid: true, errors: [] };

  const errors = (validateFn.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: e.message ?? "unknown error",
  }));

  return { valid: false, errors };
}

export function getSchemaJSON(): string {
  return JSON.stringify(
    { ...pixelAssetSchema, $id: "https://pixode.dev/schemas/pixel-asset/0.3.0", title: "Pixel Asset Document" },
    null,
    2
  ) + "\n";
}
