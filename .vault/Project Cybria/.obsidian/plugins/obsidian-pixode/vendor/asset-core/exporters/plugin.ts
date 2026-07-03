import type { PixelAssetDocument } from "../types.js";
import type { CompileResult } from "../types.js";

export interface ExportTarget {
  format: string;
  label: string;
}

export interface ExportOutput {
  filename: string;
  contentType: string;
  data: string | Uint8Array;
}

export interface ExporterPlugin {
  readonly target: ExportTarget;
  canExport(doc: PixelAssetDocument): boolean;
  export(
    doc: PixelAssetDocument,
    compiled: CompileResult
  ): ExportOutput[];
}
