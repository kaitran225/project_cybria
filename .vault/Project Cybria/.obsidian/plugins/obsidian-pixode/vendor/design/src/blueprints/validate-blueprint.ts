import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetBlueprint } from "./types.js";

export interface BlueprintValidationResult {
  ok: boolean;
  errors: Array<{ code: string; path: string; message: string }>;
}

export function validateAgainstBlueprint(
  doc: PixelAssetDocument,
  blueprint: AssetBlueprint
): BlueprintValidationResult {
  const errors: BlueprintValidationResult["errors"] = [];

  if (doc.canvas.width !== blueprint.canvas.width || doc.canvas.height !== blueprint.canvas.height) {
    errors.push({
      code: "BLUEPRINT_CANVAS_MISMATCH",
      path: "/canvas",
      message: `Canvas ${doc.canvas.width}x${doc.canvas.height} does not match blueprint ${blueprint.canvas.width}x${blueprint.canvas.height}`,
    });
  }

  const layerIds = new Set(doc.layers.map((l) => l.id));
  for (const bl of blueprint.layers) {
    if (bl.required && !layerIds.has(bl.id)) {
      errors.push({
        code: "BLUEPRINT_MISSING_LAYER",
        path: `/layers`,
        message: `Required layer "${bl.id}" missing`,
      });
    }
  }

  const regionIds = new Set(doc.regions.map((r) => r.id));
  for (const br of blueprint.regions) {
    if (br.required && !regionIds.has(br.id)) {
      errors.push({
        code: "BLUEPRINT_MISSING_REGION",
        path: `/regions`,
        message: `Required region "${br.id}" missing`,
      });
    }
  }

  const animIds = new Set(doc.animations.states.map((s) => s.id));
  for (const ba of blueprint.animations) {
    if (ba.required && !animIds.has(ba.id)) {
      errors.push({
        code: "BLUEPRINT_MISSING_ANIMATION",
        path: `/animations`,
        message: `Required animation "${ba.id}" missing`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
