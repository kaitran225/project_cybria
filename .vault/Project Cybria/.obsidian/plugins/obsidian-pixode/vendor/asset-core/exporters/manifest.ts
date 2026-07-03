import type { PixelAssetDocument } from "../types.js";
import type { CompileResult } from "../types.js";
import type { ExporterPlugin, ExportOutput, ExportTarget } from "./plugin.js";

export interface ManifestEntry {
  id: string;
  type: string;
  canvas: { width: number; height: number };
  paletteSize: number;
  layerCount: number;
  animationCount: number;
  frameCount: number;
  tags: string[];
}

export class ManifestExporter implements ExporterPlugin {
  readonly target: ExportTarget = {
    format: "manifest",
    label: "Asset Manifest",
  };

  canExport(): boolean {
    return true;
  }

  export(doc: PixelAssetDocument, compiled: CompileResult): ExportOutput[] {
    const entry: ManifestEntry = {
      id: doc.id,
      type: doc.type,
      canvas: doc.canvas,
      paletteSize: doc.palette.length,
      layerCount: doc.layers.length,
      animationCount: doc.animations?.states?.length ?? 0,
      frameCount: compiled.frames.length,
      tags: doc.metadata?.tags ?? [],
    };

    return [
      {
        filename: `${doc.id}.manifest.json`,
        contentType: "application/json",
        data: JSON.stringify(entry, null, 2) + "\n",
      },
    ];
  }
}
