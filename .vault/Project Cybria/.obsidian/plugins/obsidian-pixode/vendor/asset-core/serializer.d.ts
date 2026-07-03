import type { PixelAssetDocument } from "./types.js";
/**
 * Produces a deterministic, Git-friendly JSON string from a PixelAssetDocument.
 * Sorts pixels by y,x,c and uses a stable key order throughout.
 */
export declare function serialize(doc: PixelAssetDocument): string;
/** Parse a JSON string into an unvalidated document shape. */
export declare function deserialize(json: string): unknown;
//# sourceMappingURL=serializer.d.ts.map