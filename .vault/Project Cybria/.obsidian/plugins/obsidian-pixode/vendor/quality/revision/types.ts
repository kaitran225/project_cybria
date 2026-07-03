import type { PixelAssetDocument, SparsePixel, PaletteEntry } from "@pixode/asset-core";

export interface Revision {
  version: number;
  timestamp: string;
  author: string;
  message: string;
  document: PixelAssetDocument;
  parentVersion?: number;
}

export interface RevisionLog {
  assetId: string;
  revisions: Revision[];
  head: number;
}

export interface AssetDiff {
  paletteAdded: PaletteEntry[];
  paletteRemoved: PaletteEntry[];
  paletteChanged: Array<{ id: number; from: string; to: string }>;
  pixelsAdded: Record<string, SparsePixel[]>;
  pixelsRemoved: Record<string, SparsePixel[]>;
  layersAdded: string[];
  layersRemoved: string[];
  regionsChanged: string[];
  animationsChanged: string[];
  designChanged: boolean;
  metadataChanged: boolean;
  reviewChanged: boolean;
  generationChanged: boolean;
}
