import type { SparsePixel } from "@pixode/asset-core";

export interface PaletteColor {
  id: number;
  hex: string;
  name?: string;
  alpha?: number;
}

export interface SavedPalette {
  id: string;
  name: string;
  colors: PaletteColor[];
  collectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaletteCollection {
  id: string;
  name: string;
  paletteIds: string[];
}

export interface PixelSnippet {
  id: string;
  name: string;
  width: number;
  height: number;
  pixels: SparsePixel[];
  previewDataUrl?: string;
  paletteRef?: string;
  tags?: string[];
  createdAt: string;
  /** RLE-compressed pixel runs when large */
  compressed?: boolean;
  compressedData?: string;
}

export interface PixPaletteExport {
  format: "pixpalette";
  version: "1.0.0";
  name: string;
  colors: string[];
  collectionId?: string;
  meta?: Record<string, string>;
}

export interface PixelSnippetExport {
  format: "pixelsnippet";
  version: "1.0.0";
  id: string;
  name: string;
  width: number;
  height: number;
  pixels: SparsePixel[];
  paletteRef?: string;
  tags?: string[];
  createdAt: string;
}
