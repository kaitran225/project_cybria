import type { PixelStyle } from "../style/types.js";
import { minGenSize } from "./bounds.js";

export interface PreflightIssue {
  code: string;
  message: string;
}

export interface PreflightResult {
  ok: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
}

export interface PreflightContext {
  ramMb?: number;
  cpuAllowed?: boolean;
  activeDevice?: string;
  cudaAvailable?: boolean;
  maxGenSide?: number | null;
}

export interface GeneratePreflightContextSlice {
  style?: PixelStyle;
  blueprint?: { canvas: { width: number; height: number } };
  seed?: string;
}

export interface GeneratePreflightRequest {
  prompt: string;
  style?: PixelStyle;
  canvas?: { width: number; height: number };
  context?: GeneratePreflightContextSlice;
  diffusion?: { width?: number; height?: number; seed?: string };
  device?: string;
  force?: boolean;
}

function resolveStyle(req: GeneratePreflightRequest): PixelStyle | null {
  if (req.style) return req.style;
  if (req.context?.style) return req.context.style;
  return null;
}

function resolveCanvas(req: GeneratePreflightRequest): { width: number; height: number } | null {
  if (req.canvas) return req.canvas;
  if (req.context?.blueprint?.canvas) return req.context.blueprint.canvas;
  return null;
}

function resolveDevice(req: GeneratePreflightRequest, ctx: PreflightContext): string {
  if (req.device) return req.device;
  if (ctx.activeDevice) return ctx.activeDevice;
  return "auto";
}

function effectiveDevice(device: string, ctx: PreflightContext): string {
  if (device === "auto") {
    if (ctx.cudaAvailable) return "cuda";
    return "cpu";
  }
  return device;
}

export function validateGeneratePreflight(
  req: GeneratePreflightRequest,
  ctx: PreflightContext = {}
): PreflightResult {
  const errors: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  if (!req.prompt?.trim()) {
    errors.push({ code: "PROMPT_REQUIRED", message: "prompt is required" });
    return { ok: false, errors, warnings };
  }

  const style = resolveStyle(req);
  if (!style) {
    errors.push({ code: "STYLE_REQUIRED", message: "style is required" });
    return { ok: false, errors, warnings };
  }

  const canvas = resolveCanvas(req);
  if (!canvas) {
    errors.push({ code: "CANVAS_REQUIRED", message: "canvas is required" });
    return { ok: false, errors, warnings };
  }

  const constraints = style.canvasConstraints;
  if (constraints) {
    if (canvas.width < constraints.minWidth || canvas.width > constraints.maxWidth) {
      errors.push({
        code: "STYLE_CANVAS_WIDTH",
        message: `Canvas width ${canvas.width} outside [${constraints.minWidth}, ${constraints.maxWidth}]`,
      });
    }
    if (canvas.height < constraints.minHeight || canvas.height > constraints.maxHeight) {
      errors.push({
        code: "STYLE_CANVAS_HEIGHT",
        message: `Canvas height ${canvas.height} outside [${constraints.minHeight}, ${constraints.maxHeight}]`,
      });
    }
  }

  if (style.palette.length > style.maxColors) {
    errors.push({
      code: "STYLE_MAX_COLORS",
      message: `Palette has ${style.palette.length} colors, max ${style.maxColors}`,
    });
  }

  const genW = req.diffusion?.width ?? minGenSize(canvas.width);
  const genH = req.diffusion?.height ?? minGenSize(canvas.height);
  const minW = minGenSize(canvas.width);
  const minH = minGenSize(canvas.height);

  if (genW < minW) {
    warnings.push({
      code: "GEN_WIDTH_RAISED",
      message: `Gen width will be raised from ${genW} to ${minW} (min 2× canvas)`,
    });
  }
  if (genH < minH) {
    warnings.push({
      code: "GEN_HEIGHT_RAISED",
      message: `Gen height will be raised from ${genH} to ${minH} (min 2× canvas)`,
    });
  }

  let effectiveW = Math.max(genW, minW);
  let effectiveH = Math.max(genH, minH);

  const maxSide = ctx.maxGenSide;
  if (maxSide != null && (effectiveW > maxSide || effectiveH > maxSide)) {
    const scale = Math.min(maxSide / effectiveW, maxSide / effectiveH);
    const cappedW = Math.max(8, Math.floor((effectiveW * scale) / 8) * 8);
    const cappedH = Math.max(8, Math.floor((effectiveH * scale) / 8) * 8);
    warnings.push({
      code: "GEN_CAPPED_BY_PROFILE",
      message: `Gen will be capped from ${effectiveW}×${effectiveH} to ${cappedW}×${cappedH} (${maxSide}px max side)`,
    });
    effectiveW = cappedW;
    effectiveH = cappedH;
  }

  if (effectiveW % canvas.width !== 0 || effectiveH % canvas.height !== 0) {
    warnings.push({
      code: "GEN_NOT_EXACT_MULTIPLE",
      message:
        "Block quantization works best when gen is an exact multiple of canvas (e.g. 256/128)",
    });
  }

  if (effectiveW < 512 || effectiveH < 512) {
    warnings.push({
      code: "GEN_BELOW_SDXL_OPTIMAL",
      message: `Gen ${effectiveW}×${effectiveH} is below 512 — SDXL quality may suffer`,
    });
  }

  const device = resolveDevice(req, ctx);
  const resolved = effectiveDevice(device, ctx);

  if (resolved === "cpu") {
    if (ctx.cpuAllowed === false) {
      errors.push({
        code: "CPU_RAM_TOO_LOW",
        message: `CPU inference requires >= 4096 MB RAM (detected ${ctx.ramMb ?? "?"} MB)`,
      });
    }
    if (effectiveW > 512 || effectiveH > 512) {
      warnings.push({
        code: "CPU_SLOW_GEN",
        message: "CPU + gen > 512 may exceed the 5 min timeout — consider smaller gen or GPU",
      });
    }
    if ((effectiveW > 1024 || effectiveH > 1024) && !req.force) {
      errors.push({
        code: "CPU_GEN_TOO_LARGE",
        message: "CPU + gen > 1024 is blocked (set force: true to override)",
      });
    }
  }

  if (device === "cuda" && ctx.cudaAvailable === false) {
    errors.push({ code: "CUDA_UNAVAILABLE", message: "CUDA is not available" });
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** @deprecated Use validateGeneratePreflight */
export const validateGenerateRequest = validateGeneratePreflight;
