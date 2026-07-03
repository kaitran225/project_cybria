import type { PixelAssetDocument } from "@pixode/asset-core";
import type { Revision, RevisionLog } from "./types.js";

export function createRevisionLog(assetId: string): RevisionLog {
  return { assetId, revisions: [], head: 0 };
}

export function createRevision(
  log: RevisionLog,
  doc: PixelAssetDocument,
  author: string,
  message: string
): RevisionLog {
  const version = log.head + 1;
  const revision: Revision = {
    version,
    timestamp: new Date().toISOString(),
    author,
    message,
    document: structuredClone(doc),
    parentVersion: log.head > 0 ? log.head : undefined,
  };

  return {
    ...log,
    revisions: [...log.revisions, revision],
    head: version,
  };
}

export function getRevision(
  log: RevisionLog,
  version: number
): Revision | undefined {
  return log.revisions.find((r) => r.version === version);
}

export function getHead(log: RevisionLog): Revision | undefined {
  return getRevision(log, log.head);
}

export function getRegionHistory(
  log: RevisionLog,
  regionId: string
): Revision[] {
  return log.revisions.filter((r) =>
    r.document.regions?.some((reg) => reg.id === regionId)
  );
}
