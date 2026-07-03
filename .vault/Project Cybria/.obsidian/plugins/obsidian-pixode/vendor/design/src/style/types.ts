import type { PaletteEntry } from "@pixode/asset-core";

export interface CanvasConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface PixelStyle {
  id: string;
  version: string;
  name: string;
  outline: boolean;
  maxColors: number;
  shadowStyle: "hard" | "soft" | "none";
  palette: PaletteEntry[];
  allowedPaletteIds?: number[];
  canvasConstraints?: CanvasConstraints;
}
