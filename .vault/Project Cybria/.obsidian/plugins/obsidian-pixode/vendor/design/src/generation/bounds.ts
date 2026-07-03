import type { PixelStyle } from "../style/types.js";
import { DEFAULT_GEN_MAX } from "./constants.js";

/** SDXL prefers multiples of 8; gen must be at least 2× canvas per axis. */
export function minGenSize(canvasSize: number): number {
  return Math.ceil((canvasSize * 2) / 8) * 8;
}

export function resolveCanvasBounds(
  style: PixelStyle,
  canvas: { width: number; height: number }
): { width: number; height: number } {
  const c = style.canvasConstraints;
  if (!c) return canvas;
  return {
    width: Math.max(c.minWidth, Math.min(c.maxWidth, canvas.width)),
    height: Math.max(c.minHeight, Math.min(c.maxHeight, canvas.height)),
  };
}

export interface GenDimensionContext {
  maxGenSide?: number | null;
  genMax?: number;
}

export function resolveGenDimensions(
  canvas: { width: number; height: number },
  requested?: { width?: number; height?: number },
  ctx: GenDimensionContext = {}
): { width: number; height: number; warnings: string[] } {
  const genMax = ctx.genMax ?? DEFAULT_GEN_MAX;
  const minW = minGenSize(canvas.width);
  const minH = minGenSize(canvas.height);
  let width = requested?.width ?? minW;
  let height = requested?.height ?? minH;
  const warnings: string[] = [];

  if (width < minW) {
    warnings.push(`Gen width raised from ${width} to ${minW} (min 2× canvas)`);
    width = minW;
  }
  if (height < minH) {
    warnings.push(`Gen height raised from ${height} to ${minH} (min 2× canvas)`);
    height = minH;
  }

  width = Math.min(genMax, width);
  height = Math.min(genMax, height);

  const maxSide = ctx.maxGenSide;
  if (maxSide != null && (width > maxSide || height > maxSide)) {
    const scale = Math.min(maxSide / width, maxSide / height);
    const cappedW = Math.max(8, Math.floor((width * scale) / 8) * 8);
    const cappedH = Math.max(8, Math.floor((height * scale) / 8) * 8);
    warnings.push(
      `Gen capped from ${width}×${height} to ${cappedW}×${cappedH} (${maxSide}px max side)`
    );
    width = cappedW;
    height = cappedH;
  }

  return { width, height, warnings };
}
