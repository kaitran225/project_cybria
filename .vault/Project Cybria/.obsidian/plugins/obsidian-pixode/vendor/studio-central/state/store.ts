export interface IndexedAsset {
  id: string;
  category: string;
  path: string;
  specId?: string;
  reviewStatus: string;
  directorScore?: number;
  blueprintId?: string;
  updatedAt: string;
}

export interface ProjectStatRow {
  category: string;
  count: number;
}

export interface ReviewQueueRow {
  assetId: string;
  score?: number;
  issueCount: number;
  status: string;
  updatedAt: string;
}

export interface StateStore {
  init(): void;
  clear(): void;
  upsertAsset(row: IndexedAsset): void;
  getAssets(category?: string): IndexedAsset[];
  getAsset(id: string): IndexedAsset | undefined;
  setProjectStats(stats: ProjectStatRow[]): void;
  getProjectStats(): ProjectStatRow[];
  upsertReviewQueue(row: ReviewQueueRow): void;
  getReviewQueue(): ReviewQueueRow[];
  setThumbnail(assetId: string, cachePath: string, contentHash: string): void;
  getThumbnail(assetId: string): { cachePath: string; contentHash: string } | undefined;
}
