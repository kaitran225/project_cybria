import { createSprite } from "../../factory.js";
import type { PixelAssetDocument, SparsePixel, PaletteEntry } from "../../types.js";
import type { GeneratorBackend, GenerationContext } from "../types.js";
import { resolveAssetId } from "../../pipeline/brain/resolve.js";

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function buildPalette(ctx: GenerationContext): PaletteEntry[] {
  const biomePalette = ctx.brain.biomePalette;
  if (biomePalette && biomePalette.length > 0) {
    return biomePalette.map((p, i) => ({ ...p, id: i }));
  }

  const stylePalette = ctx.style.palette.slice(0, ctx.style.maxColors);
  if (stylePalette.length > 0) return stylePalette;

  return [
    { id: 0, hex: "#1a1c2c", role: "outline" },
    { id: 1, hex: "#38b764", role: "fill" },
    { id: 2, hex: "#a7f070", role: "highlight" },
    { id: 3, hex: "#ffffff", role: "eye" },
  ];
}

function generateSlimeBody(
  width: number,
  height: number,
  rng: () => number
): SparsePixel[] {
  const pixels: SparsePixel[] = [];
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height * 0.65);
  const rx = Math.floor(width * 0.3);
  const ry = Math.floor(height * 0.25);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const isEdge =
          ((x - 1 - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 ||
          ((x + 1 - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 ||
          ((x - cx) / rx) ** 2 + ((y - 1 - cy) / ry) ** 2 > 1 ||
          ((x - cx) / rx) ** 2 + ((y + 1 - cy) / ry) ** 2 > 1;
        pixels.push({ x, y, c: isEdge ? 0 : 1 });
      }
    }
  }

  const eyeY = cy - Math.floor(ry * 0.3);
  pixels.push({ x: cx - 2, y: eyeY, c: 3 });
  pixels.push({ x: cx + 1, y: eyeY, c: 3 });

  return pixels;
}

function generateGenericBody(
  width: number,
  height: number
): SparsePixel[] {
  const pixels: SparsePixel[] = [];
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        pixels.push({ x, y, c: 1 });
      }
    }
  }
  return pixels;
}

export class ProceduralGenerator implements GeneratorBackend {
  readonly id = "procedural";

  generate(ctx: GenerationContext): PixelAssetDocument {
    const { spec, blueprint } = ctx;
    const width = spec.canvas?.width ?? blueprint.canvas.width;
    const height = spec.canvas?.height ?? blueprint.canvas.height;
    const assetId = ctx.assetId ?? resolveAssetId(spec);
    const rng = seededRandom(ctx.seed);

    const doc = createSprite({
      id: assetId,
      width,
      height,
      type: spec.category === "tileset" ? "tileset" : spec.category === "ui_icon" ? "icon" : "sprite",
    });

    doc.version = "0.3.0";
    doc.palette = buildPalette(ctx);

    const shape = (blueprint.generationHints?.shape as string) ?? "generic";
    const bodyPixels =
      shape === "blob" || blueprint.id === "slime"
        ? generateSlimeBody(width, height, rng)
        : generateGenericBody(width, height);

    doc.layers = blueprint.layers
      .sort((a, b) => a.zOrder - b.zOrder)
      .map((bl) => ({
        id: bl.id,
        name: bl.id,
        visible: true,
        pixels: bl.role === "body" || bl.id === "body" ? [...bodyPixels] : [],
      }));

    doc.regions = blueprint.regions.map((br) => ({
      id: br.id,
      name: br.role,
      pixelRefs: doc.layers
        .flatMap((l) => l.pixels.map((p) => ({ layerId: l.id, x: p.x, y: p.y })))
        .filter((ref) => {
          const hint = blueprint.regions.find((r) => r.id === br.id)?.boundsHint;
          if (!hint) return ref.layerId === "body";
          return (
            ref.x >= hint.x &&
            ref.x < hint.x + hint.w &&
            ref.y >= hint.y &&
            ref.y < hint.y + hint.h
          );
        }),
    }));

    const animIds = spec.animations ?? blueprint.animations.map((a) => a.id);
    doc.animations = {
      states: animIds.map((aid) => ({
        id: aid,
        name: aid,
        loop: true,
        frames: [{ layerIds: doc.layers.map((l) => l.id), duration: 500 }],
      })),
      transitions: [],
    };

    doc.design = {
      species: spec.species,
      style: spec.styleId,
      outline: ctx.brain.visualLanguage.outlineRequired,
      symmetry: blueprint.symmetry === "horizontal",
    };

    doc.metadata = {
      tags: [...(spec.tags ?? []), spec.category, spec.theme ?? ""].filter(Boolean),
      category: spec.category,
    };

    doc.styleRef = { styleId: spec.styleId };
    doc.specRef = { specId: spec.id, version: spec.version };
    doc.blueprintRef = { blueprintId: blueprint.id, version: blueprint.version };

    doc.generation = {
      current: {
        specId: spec.id,
        blueprintId: blueprint.id,
        backend: this.id,
        seed: ctx.seed,
        timestamp: new Date().toISOString(),
        version: 1,
      },
      history: [],
    };

    doc.review = { status: "draft", comments: [] };

    return doc;
  }
}
