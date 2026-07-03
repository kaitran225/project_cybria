import type {
  IndexedAsset,
  ProjectStatRow,
  ReviewQueueRow,
  StateStore,
} from "./store.js";

export class MemoryStateStore implements StateStore {
  private assets = new Map<string, IndexedAsset>();
  private stats = new Map<string, number>();
  private reviewQueue = new Map<string, ReviewQueueRow>();
  private thumbnails = new Map<string, { cachePath: string; contentHash: string }>();

  init(): void {
    this.clear();
  }

  clear(): void {
    this.assets.clear();
    this.stats.clear();
    this.reviewQueue.clear();
    this.thumbnails.clear();
  }

  upsertAsset(row: IndexedAsset): void {
    this.assets.set(row.id, row);
  }

  getAssets(category?: string): IndexedAsset[] {
    const all = [...this.assets.values()];
    if (!category || category === "all") return all;
    return all.filter((a) => a.category === category);
  }

  getAsset(id: string): IndexedAsset | undefined {
    return this.assets.get(id);
  }

  setProjectStats(stats: ProjectStatRow[]): void {
    this.stats.clear();
    for (const s of stats) {
      this.stats.set(s.category, s.count);
    }
  }

  getProjectStats(): ProjectStatRow[] {
    return [...this.stats.entries()].map(([category, count]) => ({
      category,
      count,
    }));
  }

  upsertReviewQueue(row: ReviewQueueRow): void {
    this.reviewQueue.set(row.assetId, row);
  }

  getReviewQueue(): ReviewQueueRow[] {
    return [...this.reviewQueue.values()].sort(
      (a, b) => a.score ?? 100 - (b.score ?? 100)
    );
  }

  setThumbnail(
    assetId: string,
    cachePath: string,
    contentHash: string
  ): void {
    this.thumbnails.set(assetId, { cachePath, contentHash });
  }

  getThumbnail(
    assetId: string
  ): { cachePath: string; contentHash: string } | undefined {
    return this.thumbnails.get(assetId);
  }
}
