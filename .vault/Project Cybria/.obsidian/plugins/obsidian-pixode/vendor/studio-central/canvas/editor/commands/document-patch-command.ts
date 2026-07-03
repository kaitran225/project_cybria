import type { PixelAssetDocument } from "@pixode/asset-core";

export class DocumentPatchCommand {
  readonly label: string;
  private readonly before: PixelAssetDocument;
  private readonly after: PixelAssetDocument;
  private readonly apply: (doc: PixelAssetDocument) => void;

  constructor(
    label: string,
    before: PixelAssetDocument,
    after: PixelAssetDocument,
    apply: (doc: PixelAssetDocument) => void
  ) {
    this.label = label;
    this.before = structuredClone(before);
    this.after = structuredClone(after);
    this.apply = apply;
  }

  execute(): void {
    this.apply(structuredClone(this.after));
  }

  undo(): void {
    this.apply(structuredClone(this.before));
  }
}
