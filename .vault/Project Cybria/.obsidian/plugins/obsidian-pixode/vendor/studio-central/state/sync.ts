import type { PixelAssetDocument } from "@pixode/asset-core";
import type { AssetCatalogEntry } from "@pixode/asset-core/project";
import type { IndexedAsset, ProjectStatRow, StateStore } from "./store.js";

export interface SyncAssetInput {
  document: PixelAssetDocument;
  path: string;
  category: string;
  specId?: string;
  directorScore?: number;
}

function reviewStatus(doc: PixelAssetDocument): string {
  return doc.review?.status ?? "draft";
}

function countByCategory(assets: IndexedAsset[]): ProjectStatRow[] {
  const counts = new Map<string, number>();
  for (const a of assets) {
    counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

export function syncFromScan(
  store: StateStore,
  assets: SyncAssetInput[],
  catalog: AssetCatalogEntry[]
): void {
  store.init();

  const catalogMap = new Map(catalog.map((c) => [c.assetId, c]));
  const indexed: IndexedAsset[] = [];

  for (const asset of assets) {
    const cat = catalogMap.get(asset.document.id);
    const row: IndexedAsset = {
      id: asset.document.id,
      category: asset.category,
      path: asset.path,
      specId: asset.specId ?? cat?.specId,
      reviewStatus: reviewStatus(asset.document),
      directorScore: asset.directorScore,
      blueprintId: asset.document.blueprintRef?.blueprintId,
      updatedAt: new Date().toISOString(),
    };
    store.upsertAsset(row);
    indexed.push(row);

    if (
      row.reviewStatus === "in_review" ||
      row.reviewStatus === "changes_requested"
    ) {
      store.upsertReviewQueue({
        assetId: row.id,
        score: asset.directorScore,
        issueCount: asset.document.review?.comments?.filter((c) => !c.resolved).length ?? 0,
        status: row.reviewStatus,
        updatedAt: row.updatedAt,
      });
    }
  }

  store.setProjectStats(countByCategory(indexed));
}
