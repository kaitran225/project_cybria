import type { PaletteEntry, PixelAssetDocument, SparsePixel } from "@pixode/asset-core";
import { createLayerForFrame, prepareDocumentForStudio } from "./animation-ops.js";
import { updateLayerPixels } from "./layer-ops.js";

export type AiApplyMode = "new_layer" | "replace_active";

export interface AiGenerationMeta {
  prompt: string;
  model: string;
  seed?: string;
  backend?: string;
}

export interface ApplyGeneratedPixelsResult {
  document: PixelAssetDocument;
  layerId: string;
}

export function applyGeneratedPixels(
  doc: PixelAssetDocument,
  pixels: SparsePixel[],
  palette: PaletteEntry[],
  mode: AiApplyMode,
  activeLayerId: string,
  activeAnimationId: string,
  activeFrameIndex: number,
  meta: AiGenerationMeta
): ApplyGeneratedPixelsResult {
  let next = prepareDocumentForStudio({ ...doc, palette });
  let layerId = activeLayerId;

  if (mode === "new_layer") {
    next = createLayerForFrame(
      next,
      activeAnimationId,
      activeFrameIndex,
      "AI Generated"
    );
    const newLayer = next.layers[next.layers.length - 1];
    layerId = newLayer.id;
    next = updateLayerPixels(next, layerId, pixels);
  } else {
    next = updateLayerPixels(next, activeLayerId, pixels);
    layerId = activeLayerId;
  }

  const record = {
    prompt: meta.prompt,
    model: meta.model,
    seed: meta.seed,
    backend: meta.backend ?? "pixai",
    timestamp: new Date().toISOString(),
    version: (doc.generation?.current?.version ?? 0) + 1,
  };

  const history = doc.generation?.history ?? [];
  if (doc.generation?.current) {
    history.push(doc.generation.current);
  }

  next = {
    ...next,
    generation: {
      current: record,
      history,
    },
  };

  return { document: next, layerId };
}
