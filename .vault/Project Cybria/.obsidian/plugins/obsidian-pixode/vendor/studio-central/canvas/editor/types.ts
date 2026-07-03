import type { PixelAssetDocument } from "@pixode/asset-core";

export type CanvasTool =
  | "pen"
  | "erase"
  | "fill"
  | "picker"
  | "rectangle"
  | "mirror"
  | "select"
  | "move";

export interface SelectionRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CanvasEditorState {
  document: PixelAssetDocument;
  activeLayerId: string;
  activeColorId: number;
  activeTool: CanvasTool;
  brushSize: number;
  zoom: number;
  mirrorEnabled: boolean;
  activeAnimationId: string;
  activeFrameIndex: number;
  selection: SelectionRect | null;
}

export interface ViewportSettings {
  panX: number;
  panY: number;
  showBounds: boolean;
  showGrid: boolean;
  showPixelGrid: boolean;
  showCenterGuides: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface NormalizedSelection {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

export function normalizeSelection(sel: SelectionRect): NormalizedSelection {
  const minX = Math.min(sel.x0, sel.x1);
  const maxX = Math.max(sel.x0, sel.x1);
  const minY = Math.min(sel.y0, sel.y1);
  const maxY = Math.max(sel.y0, sel.y1);
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

export function isPointInSelection(
  x: number,
  y: number,
  sel: SelectionRect
): boolean {
  const { minX, maxX, minY, maxY } = normalizeSelection(sel);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}
