import type { PixelAssetDocument } from "../types.js";
import { serialize } from "../serializer.js";
import type { CompileResult } from "../types.js";
import type { ExporterPlugin, ExportOutput, ExportTarget } from "./plugin.js";

export class CanonicalJsonExporter implements ExporterPlugin {
  readonly target: ExportTarget = {
    format: "canonical-json",
    label: "Canonical JSON",
  };

  canExport(): boolean {
    return true;
  }

  export(doc: PixelAssetDocument, _compiled: CompileResult): ExportOutput[] {
    return [
      {
        filename: `${doc.id}.pixelasset.json`,
        contentType: "application/json",
        data: serialize(doc),
      },
    ];
  }
}
