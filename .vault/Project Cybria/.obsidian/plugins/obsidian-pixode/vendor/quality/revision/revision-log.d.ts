import type { PixelAssetDocument } from "@pixode/asset-core";
import type { Revision, RevisionLog } from "./types.js";
export declare function createRevisionLog(assetId: string): RevisionLog;
export declare function createRevision(log: RevisionLog, doc: PixelAssetDocument, author: string, message: string): RevisionLog;
export declare function getRevision(log: RevisionLog, version: number): Revision | undefined;
export declare function getHead(log: RevisionLog): Revision | undefined;
export declare function getRegionHistory(log: RevisionLog, regionId: string): Revision[];
//# sourceMappingURL=revision-log.d.ts.map