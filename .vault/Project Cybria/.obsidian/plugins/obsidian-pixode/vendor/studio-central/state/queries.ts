import type { StateStore } from "./store.js";

export interface DashboardData {
  stats: Record<string, number>;
  reviewQueue: number;
  totalAssets: number;
}

const CATEGORY_MAP: Record<string, string> = {
  character: "characters",
  enemy: "enemies",
  item: "items",
  tileset: "tilesets",
  ui_icon: "ui",
};

export function getDashboardData(store: StateStore): DashboardData {
  const stats: Record<string, number> = {
    characters: 0,
    enemies: 0,
    items: 0,
    tilesets: 0,
    ui: 0,
  };

  for (const row of store.getProjectStats()) {
    const key = CATEGORY_MAP[row.category] ?? row.category;
    stats[key] = (stats[key] ?? 0) + row.count;
  }

  const totalAssets = store.getAssets().length;
  const reviewQueue = store.getReviewQueue().length;

  return { stats, reviewQueue, totalAssets };
}
