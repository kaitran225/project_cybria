import Ajv from "ajv";
import type { AssetSpecification } from "./types.js";

export const assetSpecSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "version", "category", "styleId", "blueprintId"],
  properties: {
    id: { type: "string", minLength: 1, pattern: "^[a-z0-9_]+$" },
    version: { type: "string" },
    category: {
      type: "string",
      enum: ["character", "enemy", "npc", "item", "weapon", "environment", "tileset", "ui_icon"],
    },
    theme: { type: "string" },
    species: { type: "string" },
    size: { type: "string", enum: ["tiny", "small", "medium", "large"] },
    styleId: { type: "string", minLength: 1 },
    blueprintId: { type: "string", minLength: 1 },
    canvas: {
      type: "object",
      properties: {
        width: { type: "integer", minimum: 1, maximum: 1024 },
        height: { type: "integer", minimum: 1, maximum: 1024 },
      },
      additionalProperties: false,
    },
    animations: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    constraints: { type: "object" },
    metadata: {
      type: "object",
      properties: {
        author: { type: "string" },
        notes: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

const ajv = new Ajv.default({ allErrors: true });
const validateFn = ajv.compile(assetSpecSchema);

export function validateSpecSchema(data: unknown): {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
} {
  const valid = validateFn(data);
  if (valid) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: (validateFn.errors ?? []).map((e) => ({
      path: e.instancePath || "/",
      message: e.message ?? "unknown error",
    })),
  };
}

export function isAssetSpecification(data: unknown): data is AssetSpecification {
  return validateSpecSchema(data).valid;
}
