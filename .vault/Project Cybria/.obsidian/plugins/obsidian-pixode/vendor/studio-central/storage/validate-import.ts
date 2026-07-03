import type { PixPaletteExport, PixelSnippetExport } from "./types.js";

export interface ImportValidationResult {
  ok: boolean;
  errors: string[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function validatePixPaletteImport(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["Expected a JSON object"] };
  }
  const d = data as Record<string, unknown>;
  if (d.format !== "pixpalette") errors.push('format must be "pixpalette"');
  if (typeof d.version !== "string" || !VERSION_RE.test(d.version)) {
    errors.push("version must be semver (e.g. 1.0.0)");
  }
  if (typeof d.name !== "string" || d.name.length < 1) {
    errors.push("name is required");
  }
  if (!Array.isArray(d.colors) || d.colors.length < 1) {
    errors.push("colors must be a non-empty array");
  } else {
    for (let i = 0; i < d.colors.length; i++) {
      const c = d.colors[i];
      if (typeof c !== "string" || !HEX_RE.test(c)) {
        errors.push(`colors[${i}] must be a #RRGGBB hex string`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validatePixelSnippetImport(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["Expected a JSON object"] };
  }
  const d = data as Record<string, unknown>;
  if (d.format !== "pixelsnippet") errors.push('format must be "pixelsnippet"');
  if (typeof d.version !== "string" || !VERSION_RE.test(d.version)) {
    errors.push("version must be semver (e.g. 1.0.0)");
  }
  if (typeof d.id !== "string" || d.id.length < 1) errors.push("id is required");
  if (typeof d.name !== "string" || d.name.length < 1) errors.push("name is required");
  if (typeof d.width !== "number" || d.width < 1 || d.width > 512) {
    errors.push("width must be 1–512");
  }
  if (typeof d.height !== "number" || d.height < 1 || d.height > 512) {
    errors.push("height must be 1–512");
  }
  if (!Array.isArray(d.pixels)) {
    errors.push("pixels must be an array");
  } else {
    for (let i = 0; i < d.pixels.length; i++) {
      const p = d.pixels[i];
      if (!p || typeof p !== "object") {
        errors.push(`pixels[${i}] must be an object`);
        continue;
      }
      const px = p as Record<string, unknown>;
      if (typeof px.x !== "number" || typeof px.y !== "number" || typeof px.c !== "number") {
        errors.push(`pixels[${i}] requires x, y, c`);
      }
    }
  }
  if (typeof d.createdAt !== "string") errors.push("createdAt is required");
  return { ok: errors.length === 0, errors };
}

export function assertPixPaletteImport(data: unknown): PixPaletteExport {
  const result = validatePixPaletteImport(data);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return data as PixPaletteExport;
}

export function assertPixelSnippetImport(data: unknown): PixelSnippetExport {
  const result = validatePixelSnippetImport(data);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return data as PixelSnippetExport;
}
